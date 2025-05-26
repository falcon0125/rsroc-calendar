// ==UserScript==
// @name Enhanced RSROC event calendar
// @namespace http://tampermonkey.net/
// @version 0.8
// @description : 擷取活動詳細資訊並顯示在日曆頁面上
// @author Cheng Hsien Tsou
// @match https://www.rsroc.org.tw/action/*
// @match https://www.rsroc.org.tw/action/actions_onlinedetail.asp*
// @grant none
// @license MIT
// @downloadURL https://update.greasyfork.org/scripts/537049/RSROC%20Event%20Details.user.js
// @updateURL https://update.greasyfork.org/scripts/537049/RSROC%20Event%20Details.meta.js
// ==/UserScript==

/*
這個script使用來擷取RSROC網站上的活動資訊，
並將教育積分時數顯示在活動頁面上。
產生google calendar的連結，
並在滑鼠懸停時顯示活動內容和聯絡資訊的tooltip。
*/


// 立即執行函式表達式 (IIFE) 以封裝腳本
(function() {
    'use strict';

    /**
     * 根據標題從表格儲存格中提取文字內容的輔助函式。
     * @param {Document} doc - 要查詢的 DOM 文件 (可以是當前頁面的 `document` 或解析後的 HTML 文件)。
     * @param {string} headerText - 要匹配的 `<th>` 元素的文字內容。
     * @param {string} selector - 要在其中搜尋的表格列的 CSS 選擇器。
     * @param {boolean} isHtml - 如果為 true，則返回 innerHTML；否則返回 innerText。
     * @returns {string} 對應 `<td>` 的修剪後的文字內容，如果找不到則返回空字串。
     */
    function getTableCellText(doc, headerText, selector = '.articleContent table tr', isHtml = false) {
        const rows = doc.querySelectorAll(selector);
        for (const row of rows) {
            const th = row.querySelector('th');
            // 檢查標題文字是否包含目標 headerText
            if (th && th.innerText.includes(headerText)) {
                const td = row.querySelector('td');
                if (td) {
                    return isHtml ? td.innerHTML.trim() : td.innerText.trim();
                }
            }
        }
        return '';
    }
    'use strict';

    /**
     * 根據標題從表格儲存格中提取文字內容的輔助函式。
     * @param {Document} doc - 要查詢的 DOM 文件 (可以是當前頁面的 `document` 或解析後的 HTML 文件)。
     * @param {string} headerText - 要匹配的 `<th>` 元素的文字內容。
     * @param {string} selector - 要在其中搜尋的表格列的 CSS 選擇器。
     * @param {boolean} isHtml - 如果為 true，則返回 innerHTML；否則返回 innerText。
     * @returns {string} 對應 `<td>` 的修剪後的文字內容，如果找不到則返回空字串。
     */
    function getTableCellText(doc, headerText, selector = '.articleContent table tr', isHtml = false) {
        const rows = doc.querySelectorAll(selector);
        for (const row of rows) {
            const th = row.querySelector('th');
            // 檢查標題文字是否包含目標 headerText
            if (th && th.innerText.includes(headerText)) {
                const td = row.querySelector('td');
                if (td) {
                    return isHtml ? td.innerHTML.trim() : td.innerText.trim();
                }
            }
        }
        return '';
    }

    /**
     * 從給定的 Document 物件中提取活動詳細資訊。
     * 此函式整合了從當前頁面和非同步獲取的活動頁面獲取詳細資訊的邏輯。
     * @param {Document} doc - 要提取詳細資訊的 DOM 文件。
     * @returns {object} 包含提取的活動詳細資訊的物件。
     */
    function extractEventDetailsFromDocument(doc) {
        const tableData = new Map();
        const rows = doc.querySelectorAll('.articleContent table tr');
        for (const row of rows) {
            const th = row.querySelector('th');
            const td = row.querySelector('td');
            if (th && td) {
                tableData.set(th.innerText.trim(), td);
            }
        }

        const getDetail = (headerText, isHtml = false) => {
            for (const [key, value] of tableData.entries()) {
                if (key.includes(headerText)) {
                    return isHtml ? value.innerHTML.trim() : value.innerText.trim();
                }
            }
            return '';
        };

        let educationPoints = getDetail('教育積點');
        // 移除教育積點中特定的冗餘文字
        if (educationPoints) {
            educationPoints = educationPoints.replace('放射診斷科專科醫師', '').trim();
        }

        const recognizedHours = getDetail('認定時數');
        const eventDateTime = getDetail('活動日期');
        const eventLocation = getDetail('活動地點');
        // 獲取活動內容 (可以是 HTML)
        let eventContent = getDetail('活動內容', true);
        // 獲取活動說明 (可以是 HTML)
        const eventDescription = getDetail('活動說明', true);
        const contactInfo = getDetail('聯絡資訊');
        const eventOrganizer = getDetail('主辦單位'); // 明確提取主辦單位

        // 如果活動內容和活動說明都存在且不同，則合併它們
        // 這解決了使用者將「活動說明」與「活動內容」合併的要求。
        if (eventContent && eventDescription && eventContent !== eventDescription) {
            eventContent = `${eventContent}<br><br>${eventDescription}`;
        } else if (!eventContent && eventDescription) {
            // 如果只有說明存在，則將其用作內容
            eventContent = eventDescription;
        }

        let eventTitle = '';
        const caption = doc.querySelector('.tableContent caption');
        if (caption) {
            eventTitle = caption.innerText.trim();
        } else {
            // 如果找不到標題，則使用提取的主辦單位作為備用標題
            eventTitle = eventOrganizer;
        }
        // 如果找不到標題，則使用預設標題
        if (!eventTitle) {
            eventTitle = '活動';
        }

        // 移除活動標題中類似 (數字) 的模式
        eventTitle = eventTitle.replace(/\(\d+\)/g, '').trim();

        return { educationPoints, recognizedHours, eventDateTime, eventLocation, eventTitle, eventContent, contactInfo, eventOrganizer };
    }

    /**
     * 通過非同步請求從給定的 URL 獲取活動詳細資訊。
     * @param {string} url - 活動頁面的 URL。
     * @returns {Promise<object>} 解析為包含活動詳細資訊的物件的 Promise。
     */
    async function fetchEventDetails(url) {
        try {
            const response = await fetch(url);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return extractEventDetailsFromDocument(doc);
        } catch (error) {
            console.error('獲取活動詳細資訊時出錯:', error);
            // 出錯時返回預設值
            return {
                educationPoints: 'N/A',
                recognizedHours: 'N/A',
                eventDateTime: '',
                eventLocation: '',
                eventTitle: '活動',
                eventContent: '',
                contactInfo: ''
            };
        }
    }

    /**
     * 將日期和時間字串格式化為 Google 日曆 URL 格式。
     * 預期格式: YYYY/MM/DD　星期X　HH:MM ~ HH:MM
     * Google 日曆格式: YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS
     * @param {string} dateTimeString - 要格式化的日期和時間字串。
     * @returns {string|null} 格式化的日期字串，如果格式不匹配則返回 null。
     */
    function formatGoogleCalendarDate(dateTimeString) {
        const parts = dateTimeString.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2})\s*~*\s*(\d{0,2})*:*(\d{0,2})/);
        if (!parts) return null;

        const year = parts[1];
        const month = parts[2];
        const day = parts[3];
        const startHour = parts[4];
        const startMinute = parts[5];
        const endHour = parts[6] || startHour; // 如果結束小時缺失，則假設與開始小時相同
        const endMinute = parts[7] || startMinute; // 如果結束分鐘缺失，則假設與開始分鐘相同

        const start = `${year}${month}${day}T${startHour}${startMinute}00`;
        const end = `${year}${month}${day}T${endHour}${endMinute}00`;

        return `${start}/${end}`;
    }

    /**
     * 根據活動詳細資訊生成 Google 日曆 URL。
     * @param {object} details - 包含活動詳細資訊的物件。
     * @param {string} originalUrl - 活動頁面的原始 URL。
     * @returns {string|null} Google 日曆 URL，如果日期格式化失敗則返回 null。
     */
    function generateGoogleCalendarUrl(details, originalUrl) {
        const googleCalendarDate = formatGoogleCalendarDate(details.eventDateTime);
        if (!googleCalendarDate) return null;

        // 構造 Google 日曆活動的詳細資訊字串
        const calendarDetails =
            `時間: ${details.eventDateTime}\n` +
            `地點: ${details.eventLocation}\n` +
            `主辦單位: ${details.eventOrganizer || 'N/A'}\n` + // 添加了主辦單位欄位
            `教育積點: ${details.educationPoints}\n` +
            `認定時數: ${details.recognizedHours}\n` +
            `活動內容: ${details.eventContent}\n\n` + // 現在包含合併的內容/說明
            `聯絡資訊: ${details.contactInfo}\n\n` +
            `原始連結: ${originalUrl}`;

        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(details.eventTitle)}&dates=${googleCalendarDate}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(details.eventLocation)}`;
    }

    /**
     * 在活動詳細資訊頁面添加 Google 日曆連結。
     * 當使用者在特定的活動詳細資訊頁面時，此函式會執行。
     */
    function addGoogleCalendarLinkToDetailPage() {
        const details = extractEventDetailsFromDocument(document);
        const tableContent = document.querySelector('.tableContent');

        if (tableContent && details.eventDateTime) {
            const googleCalendarLinkHref = generateGoogleCalendarUrl(details, window.location.href);
            if (googleCalendarLinkHref) {
                const googleCalendarLink = document.createElement('a');
                googleCalendarLink.href = googleCalendarLinkHref;
                googleCalendarLink.target = '_blank';
                googleCalendarLink.innerText = '📅 加入 Google 日曆';
                googleCalendarLink.style.display = 'block';
                googleCalendarLink.style.marginTop = '10px';
                googleCalendarLink.style.padding = '8px 12px';
                googleCalendarLink.style.backgroundColor = '#4285F4';
                googleCalendarLink.style.color = 'white';
                googleCalendarLink.style.textDecoration = 'none';
                googleCalendarLink.style.borderRadius = '4px';
                googleCalendarLink.style.width = 'fit-content';
                googleCalendarLink.style.fontWeight = 'bold';

                tableContent.parentNode.insertBefore(googleCalendarLink, tableContent.nextSibling);
            }
        }
    }

    /**
     * 主函式，用於在日曆列表頁面添加活動詳細資訊和 Google 日曆連結。
     * 當使用者在主要的日曆列表頁面時，此函式會執行。
     */
    async function addEventDetailsToCalendarPage() {
        const eventLinks = document.querySelectorAll('.eventLink');

        // 創建一個單一的 tooltip 元素以重複使用
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
            position: absolute;
            background-color: #fff;
            border: 1px solid #ccc;
            padding: 10px;
            z-index: 1000;
            display: none;
            font-size: 0.9em;
            color: #333;
            max-width: 300px;
            word-wrap: break-word;
            pointer-events: none; /* 允許點擊穿過 tooltip 到後面的元素 */
        `;
        document.body.appendChild(tooltip);

        // 遍歷頁面上的每個活動連結
        for (const link of eventLinks) {
            const url = link.href;
            const eventDiv = link.querySelector('div.event');

            // 清理 eventDiv 的可見文字，移除類似 (數字) 的模式
            if (eventDiv) {
                eventDiv.innerText = eventDiv.innerText.replace(/\(\d+\)/g, '').trim();
            }

            // 獲取每個活動的詳細資訊
            const details = await fetchEventDetails(url);

            // 將獲取的詳細資訊存儲為 eventDiv 的 dataset 屬性，以便在懸停時輕鬆訪問
            eventDiv.dataset.eventContent = details.eventContent;
            eventDiv.dataset.contactInfo = details.contactInfo;
            eventDiv.dataset.eventTitle = details.eventTitle;
            eventDiv.dataset.eventDateTime = details.eventDateTime;
            eventDiv.dataset.eventLocation = details.eventLocation;
            eventDiv.dataset.educationPoints = details.educationPoints;
            eventDiv.dataset.recognizedHours = details.recognizedHours;
            eventDiv.dataset.eventOrganizer = details.eventOrganizer; // 存儲主辦單位

            // 如果教育積點、認定時數或活動日期可用，則顯示它們
            if (details.educationPoints !== 'N/A' || details.recognizedHours !== 'N/A' || details.eventDateTime) {
                const moreInfoDiv = document.createElement('div');
                moreInfoDiv.classList.add('moreinfo');
                moreInfoDiv.style.fontSize = '0.8em';
                moreInfoDiv.style.color = 'gray';
                moreInfoDiv.innerHTML = `${details.educationPoints}<br/>時數: ${details.recognizedHours}`;

                // 如果活動日期/時間可用，則添加 Google 日曆圖標連結
                if (details.eventDateTime) {
                    const googleCalendarLinkHref = generateGoogleCalendarUrl(details, url);
                    if (googleCalendarLinkHref) {
                        const googleCalendarLink = document.createElement('a');
                        googleCalendarLink.href = googleCalendarLinkHref;
                        googleCalendarLink.target = '_blank';
                        googleCalendarLink.innerText = '📅'; // 日曆圖標
                        googleCalendarLink.style.marginLeft = '5px';
                        moreInfoDiv.appendChild(googleCalendarLink);
                    }
                }

                eventDiv.appendChild(moreInfoDiv);
            }

            // 添加懸停事件監聽器以顯示/隱藏 tooltip
            eventDiv.addEventListener('mouseover', (event) => {
                // 從 dataset 屬性中檢索詳細資訊
                let content = eventDiv.dataset.eventContent || '無活動內容';
                // 將 HTML 換行標籤和不間斷空格替換為換行符，以提高 tooltip 的可讀性
                content = content.replace(/<br\s*\/?>/g, '\n').replace(/&nbsp;/g, ' ');
                const contact = eventDiv.dataset.contactInfo || '無聯絡資訊';
                const dateTime = eventDiv.dataset.eventDateTime || '無活動時間';
                const location = eventDiv.dataset.eventLocation || '無活動地點';

                // 使用活動詳細資訊填充 tooltip
                tooltip.innerHTML =
                    `<strong>時間:</strong><br>${dateTime}<br><br>` +
                    `<strong>地點:</strong><br>${location}<br><br>` +
                    `<strong>主辦單位:</strong><br>${eventDiv.dataset.eventOrganizer || 'N/A'}<br><br>` + // 添加了主辦單位到 tooltip
                    `<strong>教育積點:</strong><br>${eventDiv.dataset.educationPoints || '無教育積點'}<br><br>` +
                    `<strong>認定時數:</strong><br>${eventDiv.dataset.recognizedHours || '無認定時數'}<br><br>` +
                    `<strong>活動內容:</strong><br>${content}<br><br>` + // 現在包含合併的內容/說明
                    `<strong>聯絡資訊:</strong><br>${contact}`;

                // 相對於懸停的元素定位 tooltip
                const rect = event.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + window.scrollX}px`;
                tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
                tooltip.style.display = 'block'; // 顯示 tooltip
            });

            eventDiv.addEventListener('mouseout', () => {
                tooltip.style.display = 'none'; // 隱藏 tooltip
            });
        }
    }

    // 根據當前頁面 URL 運行相應的函式
    window.addEventListener('load', () => {
        if (window.location.href.startsWith('https://www.rsroc.org.tw/action/actions_onlinedetail.asp')) {
            addGoogleCalendarLinkToDetailPage();
        } else if (window.location.href.startsWith('https://www.rsroc.org.tw/action/')) {
            addEventDetailsToCalendarPage();
        }
    });

})();
