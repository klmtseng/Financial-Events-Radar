/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---
interface FinancialEvent {
  datetime: Date;
  name: string;
  description: string;
  type: 'macro' | 'corp';
  hasTime: boolean; // True if a specific time is available
  source?: string;
  impact?: 'High' | 'Medium' | 'Low';
  announcementPeriod?: 'Pre-market' | 'Post-market';
  // Macro fields (Forex Factory style)
  actual?: string;
  forecast?: string;
  previous?: string;
  sentiment?: 'good' | 'bad' | 'neutral'; // For coloring past 'actual' values
  // Corp fields
  infoType?: string;
  analystPrediction?: string;
}

// --- STATE ---
let allEvents: FinancialEvent[] = [];
let activeTimeFilter: '24h' | '7d' = '7d';

// --- DOM ELEMENTS ---
const loader = document.getElementById('loader')!;
const errorView = document.getElementById('error-view')!;
const contentView = document.getElementById('content-view')!;
const columnHeaders = document.getElementById('column-headers')!;
const eventsGrid = document.getElementById('events-grid')!;
const noEventsView = document.getElementById('no-events-view')!;
const tooltip = document.getElementById('tooltip')!;
const mainContent = document.querySelector('main')!;
const liveClock = document.getElementById('live-clock')!;

// Upcoming Events
const macroEventsContainer = document.getElementById('macro-events-container')!;
const corpEventsContainer = document.getElementById('corp-events-container')!;

// Past Events
const pastEventsToggle = document.getElementById('past-events-toggle')!;
const pastEventsContent = document.getElementById('past-events-content')!;
const pastMacroEventsContainer = document.getElementById('past-macro-events-container')!;
const pastCorpEventsContainer = document.getElementById('past-corp-events-container')!;

// Filters
const filter24hBtn = document.getElementById('filter-24h')!;
const filter7dBtn = document.getElementById('filter-7d')!;

// Subscription
const floatingSubscribe = document.getElementById('floating-subscribe')!;
const subscribeForm = document.getElementById('subscribe-form')!;
const subscribeInnerContent = document.querySelector('.subscribe-inner-content')! as HTMLElement;
const subscribeSuccess = document.getElementById('subscribe-success')!;

// --- GEMINI API ---
const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

async function fetchFinancialData(prompt: string): Promise<string> {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}],
        },
    });
    return response.text;
}

// --- DATA PARSING ---
function parseApiResponse(responseText: string, type: 'macro' | 'corp', isPast: boolean): FinancialEvent[] {
    const events: FinancialEvent[] = [];
    if (!responseText) return events;

    const lines = responseText.split('\n').filter(line => line.includes('::'));

    for (const line of lines) {
        try {
            const parts = line.split('::').map(p => p.trim());
            
            let eventDate: Date | null = null;
            let announcementPeriod: 'Pre-market' | 'Post-market' | undefined = undefined;
            let hasTime = true;

            const dateStr = parts[0].replace(/\*/g, '').trim();
            const timeStr = parts[1].trim();

            if (timeStr.toLowerCase().includes('pre-market')) {
                announcementPeriod = 'Pre-market';
                // Use a consistent UTC time for sorting (approx 9:00 AM ET)
                eventDate = new Date(`${dateStr}T13:00:00Z`);
            } else if (timeStr.toLowerCase().includes('post-market')) {
                announcementPeriod = 'Post-market';
                // Use a consistent UTC time for sorting (approx 5:00 PM ET)
                eventDate = new Date(`${dateStr}T21:00:00Z`);
            } else if (timeStr.toUpperCase() === 'N/A') {
                hasTime = false;
                // Set to midnight UTC for day-based sorting
                eventDate = new Date(`${dateStr}T00:00:00Z`);
            } else {
                 // The prompt requests HH:MM UTC, so we append 'Z' to parse it as UTC
                eventDate = new Date(`${dateStr}T${timeStr}:00Z`);
            }

            if (!eventDate || isNaN(eventDate.getTime())) {
                console.warn(`Could not parse date/time: ${parts[0]} ${parts[1]}`);
                continue;
            }

            const event: FinancialEvent = {
                datetime: eventDate,
                name: "N/A",
                description: "N/A",
                type: type,
                hasTime,
                announcementPeriod,
            };

            if (type === 'macro') {
                if (isPast) { // Past Macro: DATE::TIME::IMPACT::NAME::DESC::ACTUAL::FORECAST::PREVIOUS::SENTIMENT::SOURCE
                    event.impact = parts[2] as any;
                    event.name = parts[3];
                    event.description = parts[4];
                    event.actual = parts[5] !== 'N/A' ? parts[5] : undefined;
                    event.forecast = parts[6] !== 'N/A' ? parts[6] : undefined;
                    event.previous = parts[7] !== 'N/A' ? parts[7] : undefined;
                    event.sentiment = parts[8].toLowerCase() as any;
                    event.source = parts[9] !== 'N/A' ? parts[9] : undefined;
                } else { // Future Macro: DATE::TIME::IMPACT::NAME::DESC::FORECAST::PREVIOUS::SOURCE
                    event.impact = parts[2] as any;
                    event.name = parts[3];
                    event.description = parts[4];
                    event.forecast = parts[5] !== 'N/A' ? parts[5] : undefined;
                    event.previous = parts[6] !== 'N/A' ? parts[6] : undefined;
                    event.source = parts[7] !== 'N/A' ? parts[7] : undefined;
                }
            } else { // corp
                const [ , , name, description, ...rest] = parts;
                event.name = name;
                event.description = description;

                if (isPast) { // ...::INFO_TYPE::REAL::PREDICTION::SOURCE
                    event.infoType = rest[0] !== 'N/A' ? rest[0] : undefined;
                    event.actual = rest[1] !== 'N/A' ? rest[1] : undefined;
                    event.analystPrediction = rest[2] !== 'N/A' ? rest[2] : undefined;
                    event.source = rest[3] !== 'N/A' ? rest[3] : undefined;
                } else { // ...::INFO_TYPE::PREDICTION::SOURCE
                    event.infoType = rest[0] !== 'N/A' ? rest[0] : undefined;
                    event.analystPrediction = rest[1] !== 'N/A' ? rest[1] : undefined;
                    event.source = rest[2] !== 'N/A' ? rest[2] : undefined;
                }
            }
            events.push(event);
        } catch (e) {
            console.error("Error parsing line:", line, e);
        }
    }
    return events;
}

// --- RENDERING LOGIC ---
function renderEvents() {
    // Clear all containers first
    macroEventsContainer.innerHTML = '';
    corpEventsContainer.innerHTML = '';
    pastMacroEventsContainer.innerHTML = '';
    pastCorpEventsContainer.innerHTML = '';

    const now = new Date();
    const futureEvents = allEvents.filter(event => event.datetime >= now);
    const pastEvents = allEvents.filter(event => event.datetime < now);

    // --- RENDER UPCOMING EVENTS ---
    const futureLimit = new Date();
    if (activeTimeFilter === '24h') {
        futureLimit.setHours(now.getHours() + 24);
    } else {
        futureLimit.setDate(now.getDate() + 7);
    }

    const timeFilteredEvents = futureEvents.filter(event => event.datetime <= futureLimit);

    const macroEvents = timeFilteredEvents
        .filter(event => event.type === 'macro')
        .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    const corpEvents = timeFilteredEvents
        .filter(event => event.type === 'corp')
        .sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    if (macroEvents.length === 0 && corpEvents.length === 0) {
        noEventsView.style.display = 'block';
        eventsGrid.style.display = 'none';
    } else {
        noEventsView.style.display = 'none';
        eventsGrid.style.display = 'grid';
    }
    
    // Helper function to render events for a column
    const populateColumn = (container: HTMLElement, events: FinancialEvent[], type: 'macro' | 'corp', isPast: boolean = false) => {
        if (events.length === 0 && !isPast) { // Don't show "no events" message for past section
             container.innerHTML = `<div class="no-events-column">No upcoming ${type} events in this timeframe.</div>`;
             return;
        }

        const eventsByDay = events.reduce((acc, event) => {
            const day = event.datetime.toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
            if (!acc[day]) {
                acc[day] = [];
            }
            acc[day].push(event);
            return acc;
        }, {} as Record<string, FinancialEvent[]>);

        const sortedDays = Object.keys(eventsByDay).sort((a, b) => {
            const dateA = eventsByDay[a][0].datetime.getTime();
            const dateB = eventsByDay[b][0].datetime.getTime();
            return isPast ? dateB - dateA : dateA - dateB; 
        });

        for (const day of sortedDays) {
            const dayGroup = document.createElement('div');
            dayGroup.className = 'day-group';
            
            const dayHeader = document.createElement('h3');
            dayHeader.className = 'day-header';

            if (!isPast) {
                dayHeader.setAttribute('role', 'button');
                dayHeader.setAttribute('aria-expanded', 'true');
                dayHeader.innerHTML = `
                    <span>${day}</span>
                    <svg class="chevron-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="20" height="20">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                    </svg>
                `;
            } else {
                dayHeader.textContent = day;
            }

            dayGroup.appendChild(dayHeader);

            const dayEventsContainer = document.createElement('div');
            dayEventsContainer.className = 'day-events-container';

            for (const event of eventsByDay[day]) {
                const eventCard = document.createElement('div');
                const tagClass = event.type === 'macro' ? 'macro' : 'corp';
                const pastClass = isPast ? 'past' : '';
                const impactClass = event.impact ? `impact-${event.impact.toLowerCase()}` : '';
                eventCard.className = `event-card ${tagClass} ${pastClass} ${impactClass}`;
                
                let detailsHtml = '';
                if (event.type === 'macro') {
                     detailsHtml = `
                        <div class="event-figures">
                            <div class="figure-item"><span class="figure-label">Actual</span><span class="figure-value sentiment-${event.sentiment || 'neutral'}">${event.actual || '—'}</span></div>
                            <div class="figure-item"><span class="figure-label">Forecast</span><span class="figure-value">${event.forecast || '—'}</span></div>
                            <div class="figure-item"><span class="figure-label">Previous</span><span class="figure-value">${event.previous || '—'}</span></div>
                        </div>`;
                } else { // corp
                    let detailsItems = '';
                    if (event.infoType) detailsItems += `<div class="detail-item"><span class="detail-label">Info Type</span><span class="detail-value">${event.infoType}</span></div>`;
                    if (isPast && event.actual) detailsItems += `<div class="detail-item"><span class="detail-label">Actual</span><span class="detail-value">${event.actual}</span></div>`;
                    if (event.analystPrediction) detailsItems += `<div class="detail-item"><span class="detail-label">Prediction</span><span class="detail-value">${event.analystPrediction}</span></div>`;
                    detailsHtml = detailsItems ? `<div class="event-details">${detailsItems}</div>` : '';
                }
                
                const sourceHtml = event.source ? `<p class="event-source">Source: ${event.source}</p>` : '';
                
                let eventTime: string;
                let countdownHtml: string;
            
                if (event.type === 'corp' && event.announcementPeriod) {
                    eventTime = event.announcementPeriod;
                    countdownHtml = '<span class="event-countdown"></span>';
                } else if (!event.hasTime) {
                    eventTime = '—';
                    countdownHtml = '<span class="event-countdown"></span>';
                } else {
                    eventTime = event.datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    countdownHtml = !isPast ? `<span class="event-countdown" data-event-timestamp="${event.datetime.getTime()}"></span>` : '<span class="event-countdown"></span>';
                }

                eventCard.innerHTML = `
                    <div class="event-header">
                        <h4 class="event-name" data-description="${event.description.replace(/"/g, '&quot;')}">${event.name}</h4>
                        <div class="event-time-details">
                            <span class="event-time">${eventTime}</span>
                            ${countdownHtml}
                        </div>
                    </div>
                    ${detailsHtml}
                    ${sourceHtml}
                `;
                dayEventsContainer.appendChild(eventCard);
            }
            dayGroup.appendChild(dayEventsContainer);
            container.appendChild(dayGroup);
        }
    };

    populateColumn(macroEventsContainer, macroEvents, 'macro');
    populateColumn(corpEventsContainer, corpEvents, 'corp');

    // --- RENDER PAST EVENTS ---
    const pastMacroEvents = pastEvents.filter(e => e.type === 'macro');
    const pastCorpEvents = pastEvents.filter(e => e.type === 'corp');
    
    populateColumn(pastMacroEventsContainer, pastMacroEvents, 'macro', true);
    populateColumn(pastCorpEventsContainer, pastCorpEvents, 'corp', true);
    
    updateCountdowns(); // Initial countdown update
}

// --- TIME & COUNTDOWN LOGIC ---
function updateHeaderClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleString(undefined, {
        dateStyle: 'full',
        timeStyle: 'medium',
    });
}

function formatTimeDifference(ms: number): string {
    if (ms <= 0) {
        return "Announced";
    }
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (days > 0) return `in ${days}d ${hours}h`;
    if (hours > 0) return `in ${hours}h ${minutes}m`;
    if (minutes > 0) return `in ${minutes}m`;
    return `Upcoming`;
}

function updateCountdowns() {
    const now = new Date().getTime();
    const countdownElements = document.querySelectorAll<HTMLElement>('.event-countdown');
    countdownElements.forEach(el => {
        const eventTimestamp = parseInt(el.dataset.eventTimestamp || '0', 10);
        if (eventTimestamp > 0) {
            const diff = eventTimestamp - now;
            el.textContent = formatTimeDifference(diff);
        }
    });
}


// --- EVENT HANDLERS ---
function setupEventListeners() {
    filter24hBtn.addEventListener('click', () => setTimeFilter('24h'));
    filter7dBtn.addEventListener('click', () => setTimeFilter('7d'));
    
    // Past events accordion
    pastEventsToggle.addEventListener('click', () => {
        const isExpanded = pastEventsToggle.getAttribute('aria-expanded') === 'true';
        pastEventsToggle.setAttribute('aria-expanded', String(!isExpanded));
        pastEventsContent.classList.toggle('expanded');
    });
    
    // Day group accordion for upcoming events
    const handleDayToggle = (e: Event) => {
        const header = (e.target as HTMLElement).closest('.day-header');
        if (header) {
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!isExpanded));
            header.parentElement?.classList.toggle('collapsed');
        }
    };
    macroEventsContainer.addEventListener('click', handleDayToggle);
    corpEventsContainer.addEventListener('click', handleDayToggle);

    // --- Tooltip Logic (via Event Delegation) ---
    mainContent.addEventListener('mouseover', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('event-name') && target.dataset.description) {
            tooltip.innerHTML = target.dataset.description;
            tooltip.style.display = 'block';
            tooltip.setAttribute('aria-hidden', 'false');
        }
    });
    
    mainContent.addEventListener('mousemove', (e) => {
        if (tooltip.style.display === 'block') {
            const x = e.clientX;
            const y = e.clientY;
    
            tooltip.style.left = `${x + 15}px`;
            tooltip.style.top = `${y + 15}px`;
    
            const rect = tooltip.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                tooltip.style.left = `${x - rect.width - 15}px`;
            }
            if (rect.bottom > window.innerHeight) {
                tooltip.style.top = `${y - rect.height - 15}px`;
            }
        }
    });
    
    mainContent.addEventListener('mouseout', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('event-name')) {
            tooltip.style.display = 'none';
            tooltip.setAttribute('aria-hidden', 'true');
        }
    });

    // Floating subscribe bar logic
    const handleScroll = () => {
        const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
        if (isAtBottom) {
            floatingSubscribe.classList.add('expanded');
        } else if (!floatingSubscribe.matches(':hover')) {
            floatingSubscribe.classList.remove('expanded');
        }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    floatingSubscribe.addEventListener('mouseenter', () => {
        floatingSubscribe.classList.add('expanded');
    });
    
    floatingSubscribe.addEventListener('mouseleave', () => {
         const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 1;
         if (!isAtBottom) {
            floatingSubscribe.classList.remove('expanded');
         }
    });

    subscribeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        subscribeInnerContent.style.display = 'none';
        subscribeSuccess.style.display = 'block';
    });
}

function setTimeFilter(filter: '24h' | '7d') {
    activeTimeFilter = filter;
    
    filter24hBtn.classList.toggle('active', filter === '24h');
    filter7dBtn.classList.toggle('active', filter === '7d');
    
    filter24hBtn.setAttribute('aria-selected', (filter === '24h').toString());
    filter7dBtn.setAttribute('aria-selected', (filter === '7d').toString());

    renderEvents();
}

// --- INITIALIZATION ---
async function initializeApp() {
    setupEventListeners();
    setInterval(updateHeaderClock, 1000);
    setInterval(updateCountdowns, 1000);
    updateHeaderClock();

    try {
        const futureMacroPrompt = `List major global macroeconomic events for the next 7 days. For each event, provide: Date (YYYY-MM-DD), Time in UTC (HH:MM), Impact (High, Medium, or Low), Event Name, Brief Description, Forecast, Previous, and Source. Format each on a new line: YYYY-MM-DD::HH:MM::Impact::Event Name::Description::Forecast::Previous::Source. Use "N/A" for the time if it's an all-day event or unknown. Use "N/A" for other unknown values.`;
        const pastMacroPrompt = `List major global macroeconomic events from the past 3 days. For each event, provide: Date (YYYY-MM-DD), Time in UTC (HH:MM), Impact (High, Medium, or Low), Event Name, Brief Description, Actual, Forecast, Previous, Sentiment (Good, Bad, or Neutral, based on Actual vs Forecast), and Source. Format each on a new line: YYYY-MM-DD::HH:MM::Impact::Event Name::Description::Actual::Forecast::Previous::Sentiment::Source. Use "N/A" for the time if it was an all-day event or unknown. Use "N/A" for other unknown values.`;
        const futureEarningsPrompt = `List the most anticipated corporate earnings for the next 7 days. Provide: date (YYYY-MM-DD), announcement time in UTC (HH:MM) OR the period ("pre-market", "post-market"), company name (TICKER), description of expectations, information type (e.g., "Q2 Earnings"), a key analyst prediction (e.g., "EPS: $1.25"), and the source. Format each: YYYY-MM-DD::HH:MM or Period::COMPANY (TICKER)::DESCRIPTION::INFO_TYPE::PREDICTION::SOURCE. Use "N/A" if a value is not available.`;
        const pastEarningsPrompt = `List significant corporate earnings from the past 3 days. Provide: date (YYYY-MM-DD), announcement time in UTC (HH:MM) OR the period ("pre-market", "post-market"), company name (TICKER), results summary, information type, the actual result (e.g., "EPS: $1.30"), analyst prediction, and the source. Format each: YYYY-MM-DD::HH:MM or Period::COMPANY (TICKER)::SUMMARY::INFO_TYPE::ACTUAL::PREDICTION::SOURCE. Use "N/A" if a value is not available.`;

        const [
            futureMacroResponse, 
            futureEarningsResponse,
            pastMacroResponse,
            pastEarningsResponse
        ] = await Promise.all([
            fetchFinancialData(futureMacroPrompt),
            fetchFinancialData(futureEarningsPrompt),
            fetchFinancialData(pastMacroPrompt),
            fetchFinancialData(pastEarningsPrompt)
        ]);

        const futureMacroEvents = parseApiResponse(futureMacroResponse, 'macro', false);
        const futureCorpEarnings = parseApiResponse(futureEarningsResponse, 'corp', false);
        const pastMacroEvents = parseApiResponse(pastMacroResponse, 'macro', true);
        const pastCorpEarnings = parseApiResponse(pastEarningsResponse, 'corp', true);
        
        allEvents = [...futureMacroEvents, ...futureCorpEarnings, ...pastMacroEvents, ...pastCorpEarnings];

        renderEvents();
        
        loader.style.display = 'none';
        contentView.style.display = 'block';
        columnHeaders.style.display = 'grid';


    } catch (error) {
        console.error("Failed to fetch financial data:", error);
        loader.style.display = 'none';
        errorView.style.display = 'block';
    }
}

// Start the application
initializeApp();
