export const littleNotes=[
 'Just passing by to remind you: you’re my favorite person. ♡',
 'No need to reply right now. Sending you a little pocket of love.',
 'When you have a minute, tell me the best tiny part of your day.',
 'A virtual hug, exactly the size you need today. ♡',
 'I wish we could pause everything for a cup of tea together.'
];
const dates=[
 ['A song for two','Choose one song each. Listen, then tell each other which line stayed with you.','Want to trade one song each tonight and tell each other our favorite line? ♡'],
 ['The five-minute picnic','Bring a snack and a drink. Find a little window of time and share the view.','A five-minute picnic, even from different places? Bring your favorite snack. ♡'],
 ['A tiny time capsule','Finish “One thing I want future us to remember…” and save your replies as keepsakes.','One thing I want future us to remember… What would you put in our little time capsule?'],
 ['Our imaginary café','Invent a café together: the name, the first drink and the music by the window.','Let’s invent our own little café. What should we call it, and what’s the first thing on our menu?'],
 ['A photo of the ordinary','Each share one ordinary detail from today. A corner of the sky counts.','Show me one ordinary little detail from your day? I’ll send one too. ♡'],
 ['Three little wishes','A wish for this week, one for someday, and one delightfully silly wish.','Three little wishes: one for this week, one for someday, and one completely silly. You go first? ♡'],
 ['A slow Sunday, imagined','Plan a slow Sunday together, from the first sleepy hello to the last goodnight.','What would our perfect slow Sunday look like, from breakfast to goodnight? ♡'],
 ['The compliment exchange','Notice something specific: a kindness, a habit, a small brave thing.','Something I noticed and loved about you recently… Let’s trade one tiny compliment. ♡']
];
export function dayIndex(day){return [...day].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,17)}
export function dateFor(day,offset=0){const [title,description,invite]=dates[(dayIndex(day)+offset)%dates.length];return {title,description,invite}}
export function fireflySequence(seed,length){let n=seed>>>0||1;return Array.from({length},()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return (n>>>16)%4})}
