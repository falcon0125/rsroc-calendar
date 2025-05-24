// ==UserScript==
// @name Enhanced RSROC Events Calendar
// @namespace http://tampermonkey.net/
// @version 0.7
// @description : Extract event details and display them on the calendar page
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


// Immediately-invoked function expression (IIFE) to encapsulate the script
(function() {
    'use strict';

    // Function to fetch event details from a given URL
    async function fetchEventDetails(url) {
        try {
            // Fetch the HTML content of the event page
            const response = await fetch(url);
            const html = await response.text();
            // Parse the HTML string into a DOM document
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Initialize variables to store extracted details
            let educationPoints = '';
            let recognizedHours = '';
            let eventDateTime = '';
            let eventLocation = '';
            let eventTitle = '';
            let eventContent = '';
            let contactInfo = '';

            // Select all table rows within the article content
            const rows = doc.querySelectorAll('.articleContent table tr');
            // Iterate over each row to find specific details
            for (const row of rows) {
                const th = row.querySelector('th');
                if (th) {
                    // Check the header text to identify the data
                    if (th.innerText.includes('活動日期')) {
                        const td = row.querySelector('td');
                        if (td) eventDateTime = td.innerText.trim();
                    }
                     if (th.innerText.includes('主辦單位')) {
                         // Extract event title from caption
                         const caption = doc.querySelector('.tableContent caption');
                         if (caption) eventTitle = caption.innerText.trim();
                    }
                    if (th.innerText.includes('活動地點')) {
                        const td = row.querySelector('td');
                        if (td) eventLocation = td.innerText.trim();
                    }
                     if (th.innerText.includes('活動內容')) {
                        const td = row.querySelector('td');
                        if (td) eventContent = td.innerText.trim();
                    }
                    if (th.innerText.includes('教育積點')) {
                        const td = row.querySelector('td');
                        if (td) educationPoints = td.innerText.replace('放射診斷科專科醫師', '').trim();
                    }
                    if (th.innerText.includes('認定時數')) {
                        const td = row.querySelector('td');
                        if (td) recognizedHours = td.innerText.trim();
                    }
                     if (th.innerText.includes('聯絡資訊')) {
                        const td = row.querySelector('td');
                        if (td) contactInfo = td.innerText.trim();
                    }
                }
            }
            // Return an object containing the extracted details
            return { educationPoints, recognizedHours, eventDateTime, eventLocation, eventTitle, eventContent, contactInfo };
        } catch (error) {
            // Log any errors during fetching or parsing
            console.error('Error fetching event details:', error);
            // Return default values in case of an error
            return { educationPoints: 'N/A', recognizedHours: 'N/A', eventDateTime: '', eventLocation: '', eventTitle: 'Event', eventContent: '', contactInfo: '' };
        }
    }

    // Function to format the date and time string for Google Calendar
    function formatGoogleCalendarDate(dateTimeString) {
        // Expected format: YYYY/MM/DD　星期X　HH:MM ~ HH:MM
        // Use regex to extract date and time components
        const parts = dateTimeString.match(/(\d{4})\/(\d{2})\/(\d{2}).*?(\d{2}):(\d{2})\s*~*\s*(\d{0,2})*:*(\d{0,2})/);
        if (!parts) return null; // Return null if the format doesn't match

        // Extract components from regex parts
        const year = parts[1];
        const month = parts[2];
        const day = parts[3];
        const startHour = parts[4];
        const startMinute = parts[5];
        const endHour = parts[6] || startHour; // Assume same hour if end hour is missing
        const endMinute = parts[7] || startMinute; // Assume same minute if end minute is missing

        // Google Calendar format: YYYYMMDDTHHMMSS/YYYYMMDDTHHMMSS
        const start = `${year}${month}${day}T${startHour}${startMinute}00`;
        const end = `${year}${month}${day}T${endHour}${endMinute}00`;

        // Return the formatted date string
        return `${start}/${end}`;
    }

    // Function to extract event details from the current page's DOM
    function extractDetailsFromCurrentPage() {
        let educationPoints = '';
        let recognizedHours = '';
        let eventDateTime = '';
        let eventLocation = '';
        let eventTitle = '';
        let eventContent = '';
        let contactInfo = '';

        const rows = document.querySelectorAll('.articleContent table tr');
        for (const row of rows) {
            const th = row.querySelector('th');
            if (th) {
                if (th.innerText.includes('活動日期')) {
                    const td = row.querySelector('td');
                    if (td) eventDateTime = td.innerText.trim();
                }
                if (th.innerText.includes('主辦單位')) {
                    const caption = document.querySelector('.tableContent caption');
                    if (caption) eventTitle = caption.innerText.trim();
                }
                if (th.innerText.includes('活動地點')) {
                    const td = row.querySelector('td');
                    if (td) eventLocation = td.innerText.trim();
                }
                if (th.innerText.includes('活動內容')) {
                    const td = row.querySelector('td');
                    if (td) eventContent = td.innerText.trim();
                }
                if (th.innerText.includes('教育積點')) {
                    const td = row.querySelector('td');
                    if (td) educationPoints = td.innerText.replace('放射診斷科專科醫師', '').trim();
                }
                if (th.innerText.includes('認定時數')) {
                    const td = row.querySelector('td');
                    if (td) recognizedHours = td.innerText.trim();
                }
                if (th.innerText.includes('聯絡資訊')) {
                    const td = row.querySelector('td');
                    if (td) contactInfo = td.innerText.trim();
                }
            }
        }
        return { educationPoints, recognizedHours, eventDateTime, eventLocation, eventTitle, eventContent, contactInfo };
    }

    // Function to add Google Calendar link to the event detail page
    function addGoogleCalendarLinkToDetailPage() {
        const details = extractDetailsFromCurrentPage();
        const tableContent = document.querySelector('.tableContent'); // Get the table containing the caption

        if (tableContent && details.eventDateTime) {
            const googleCalendarDate = formatGoogleCalendarDate(details.eventDateTime);
            if (googleCalendarDate) {
                const googleCalendarLink = document.createElement('a');
                const calendarDetails = `時間: ${details.eventDateTime}\n地點: ${details.eventLocation}\n教育積點: ${details.educationPoints}\n認定時數: ${details.recognizedHours}\n活動內容: ${details.eventContent}\n\n聯絡資訊: ${details.contactInfo}\n\n原始連結: ${window.location.href}`;
                googleCalendarLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(details.eventTitle)}&dates=${googleCalendarDate}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(details.eventLocation)}`;
                googleCalendarLink.target = '_blank';
                googleCalendarLink.innerText = '📅 加入 Google 日曆';
                googleCalendarLink.style.display = 'block'; // Make it a block element for better spacing
                googleCalendarLink.style.marginTop = '10px';
                googleCalendarLink.style.padding = '8px 12px';
                googleCalendarLink.style.backgroundColor = '#4285F4';
                googleCalendarLink.style.color = 'white';
                googleCalendarLink.style.textDecoration = 'none';
                googleCalendarLink.style.borderRadius = '4px';
                googleCalendarLink.style.width = 'fit-content'; // Adjust width to content
                googleCalendarLink.style.fontWeight = 'bold';

                // Insert the link after the table containing the caption
                tableContent.parentNode.insertBefore(googleCalendarLink, tableContent.nextSibling);
            }
        }
    }

    // Main function to add event details and Google Calendar links to the calendar page
    async function addEventDetailsToCalendarPage() {
        const eventLinks = document.querySelectorAll('.eventLink');

        // Create tooltip element
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
            pointer-events: none;
        `;
        document.body.appendChild(tooltip);

        for (const link of eventLinks) {
            const url = link.href;
            const eventDiv = link.querySelector('div.event');
            const eventText = eventDiv.innerText;

            const details = await fetchEventDetails(url);

            // Store details on the eventDiv
            eventDiv.dataset.eventContent = details.eventContent;
            eventDiv.dataset.contactInfo = details.contactInfo;
            eventDiv.dataset.eventTitle = details.eventTitle;
            eventDiv.dataset.eventDateTime = details.eventDateTime;
            eventDiv.dataset.eventLocation = details.eventLocation;
            eventDiv.dataset.educationPoints = details.educationPoints;
            eventDiv.dataset.recognizedHours = details.recognizedHours;

            if (details.educationPoints !== 'N/A' || details.recognizedHours !== 'N/A' || details.eventDateTime) {
                const moreInfoDiv = document.createElement('div');
                moreInfoDiv.classList.add('moreinfo');
                moreInfoDiv.style.fontSize = '0.8em';
                moreInfoDiv.style.color = 'gray';
                moreInfoDiv.innerHTML = `${details.educationPoints}<br/>時數: ${details.recognizedHours}`;

                if (details.eventDateTime) {
                    const googleCalendarDate = formatGoogleCalendarDate(details.eventDateTime);
                    if (googleCalendarDate) {
                        const googleCalendarLink = document.createElement('a');
                        const calendarDetails = `時間: ${details.eventDateTime}\n教育積點: ${details.educationPoints}\n認定時數: ${details.recognizedHours}\n活動內容: ${details.eventContent}\n\n聯絡資訊: ${details.contactInfo}\n\n原始連結: ${url}`;
                        googleCalendarLink.href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(details.eventTitle)}&dates=${googleCalendarDate}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(details.eventLocation)}`;
                        googleCalendarLink.target = '_blank';
                        googleCalendarLink.innerText = '📅';
                        googleCalendarLink.style.marginLeft = '5px';
                        moreInfoDiv.appendChild(googleCalendarLink);
                    }
                }

                eventDiv.appendChild(moreInfoDiv);
            }

            // Add hover event listeners
            eventDiv.addEventListener('mouseover', () => {
                let content = eventDiv.dataset.eventContent || '無活動內容';
                const contact = eventDiv.dataset.contactInfo || '無聯絡資訊';
                const dateTime = eventDiv.dataset.eventDateTime || '無活動時間';
                const location = eventDiv.dataset.eventLocation || '無活動地點';

                if (link.href.startsWith('https://www.rsroc.org.tw/action/actions_onlinedetail.asp')) {
                    const googleCalendarDate = formatGoogleCalendarDate(eventDiv.dataset.eventDateTime);
                    if (googleCalendarDate) {
                        const eventTitle = eventDiv.dataset.eventTitle;
                        const eventLocation = eventDiv.dataset.eventLocation;
                        const originalUrl = link.href;

                        const calendarDetailsForTooltip = `時間: ${dateTime}\n地點: ${location}\n活動內容: ${content}\n\n聯絡資訊: ${contact}\n\n原始連結: ${originalUrl}`;
                        const googleCalendarLinkHtml = `<a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${googleCalendarDate}&details=${encodeURIComponent(calendarDetailsForTooltip)}&location=${encodeURIComponent(eventLocation)}" target="_blank">📅 加入 Google 日曆</a>`;
                        
                    }
                }

                tooltip.innerHTML = `<strong>時間:</strong><br>${dateTime}<br><br><strong>地點:</strong><br>${location}<br><br><strong>教育積點:</strong><br>${eventDiv.dataset.educationPoints || '無教育積點'}<br><br><strong>認定時數:</strong><br>${eventDiv.dataset.recognizedHours || '無認定時數'}<br><br><strong>活動內容:</strong><br>${content}<br><br><strong>聯絡資訊:</strong><br>${contact}`;

                // Position the tooltip
                const rect = event.target.getBoundingClientRect();
                tooltip.style.left = `${rect.left + window.scrollX}px`;
                tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
                tooltip.style.display = 'block';
            });

            eventDiv.addEventListener('mouseout', () => {
                tooltip.style.display = 'none';
            });
        }
    }

    // Run the script after the page has loaded
    window.addEventListener('load', () => {
        if (window.location.href.startsWith('https://www.rsroc.org.tw/action/actions_onlinedetail.asp')) {
            addGoogleCalendarLinkToDetailPage();
        } else if (window.location.href.startsWith('https://www.rsroc.org.tw/action/')) {
            addEventDetailsToCalendarPage();
        }
    });

})();
