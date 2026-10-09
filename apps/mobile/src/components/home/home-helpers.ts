export function getGreeting(): {
  key:
    | 'home.greetingMorning'
    | 'home.greetingAfternoon'
    | 'home.greetingEvening'
    | 'home.greetingNight';
} {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { key: 'home.greetingMorning' };
  if (hour >= 12 && hour < 17) return { key: 'home.greetingAfternoon' };
  if (hour >= 17 && hour < 22) return { key: 'home.greetingEvening' };
  return { key: 'home.greetingNight' };
}
