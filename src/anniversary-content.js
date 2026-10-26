export const ANNIVERSARY_SONG='https://htmlhoster.com/p/E1P7QWAA/Ayed-Awedak-Lirik-Arab-dan-Terjemahan-Terbaru-Viral-Tiktok.mp3.mpeg';
export const RELEASE='2026-10-26T18:30:00Z';
export const dialogue=[
 '',
 'Zaahid has a surprise for you...',
 'I think you know what day it is today...',
 'It is...',
 "IT IS YOURRR GUUYS'S ONE MONTH ANNIVERSARYYY ❤️❤️🤭",
 'Okayyy, enough of my dramatic entrance 🤭',
 'Someone wrote something really special for you...',
 'And trust me, this boy has a LOT to say. 😂❤️',
 '',
 'Soooo... now you see how much your future husband loves you. 🤭❤️',
 'I mean, come onnn. The boy really wrote his whole heart out for you. 😂❤️',
 'And yk what makes you two even more special?',
 'Even when he messed things up, he apologized... and you were kind enough to forgive him.',
 "That's what makes your story beautiful. You both keep choosing each other. ❤️",
 'You guyzzz are genuinely such an amazing couple.',
 'And I have a feeling that one day, people are gonna look at you two and say...',
 'You guys are such an amazing couple. ❤️',
 'Okaaayyy, I think my job here is done. 🤭',
 "Byeeee! I'm pretty sure your boyfriend is asleep right now...",
 "And honestly, I'm getting sleepy too. 😂",
 'Gnnnn, and happy one-month anniversary, you twoooo! ❤️',
 'Gnn 😂❤️',
 "One month down. Insha'Allah, many more to go. ❤️"
];
export function releaseDelay(status){return Math.max(0,Date.parse(status.release_at)-Date.parse(status.server_now))}
