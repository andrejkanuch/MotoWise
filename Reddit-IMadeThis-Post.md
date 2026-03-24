# r/IMadeThis Post — DRAFT

---

## HOW TO POST THIS ON REDDIT

1. Go to r/IMadeThis → Create Post
2. Select appropriate flair if required (check available options — likely "App", "Software", "Tech" or similar)
3. Post as either **video** (recommended — use the screen recording) or **image gallery** with text
4. Use one of the titles below

**When to post:** Space it out from the Claude/dev subs. This is a different audience — makers, hobbyists, creatives. Weekend posting can work well here.

**Tone:** This is a maker community. Lead with the personal story and what the thing does, not the tech. People here want to see cool stuff and hear why you built it.

---

## TITLE (pick one):

**Option A:** I made a motorcycle maintenance app because my bike broke down and I had no idea what was wrong

**Option B:** My bike broke down on a trip and I couldn't figure out what was wrong. So I built an app for that.

**Option C:** I built a motorcycle app that tracks maintenance, expenses, rides, and has an AI diagnostic tool for when something goes wrong

---

## POST BODY:

I ride motorcycles as a hobby. A while back my bike broke down during a trip — I was standing on the side of the road googling symptoms, getting conflicting answers from forums, and had no idea what to tell the mechanic when I finally called one. That bugged me enough to do something about it.

So I built [MotoVault](https://motovault.app/).

It's a mobile app for motorcycle owners that does a few things:

**Maintenance tracking** — log every service task per bike with intervals, priority levels, and reminders. I used to forget when I last changed oil or checked chain tension. Now it just tells me.

**Expense tracking** — every cost logged by category (fuel, parts, service, gear) with monthly trend charts. Turns out I spend way more on gear than I thought.

**Ride logging** — records your rides with distance, duration, average/max speed, elevation gain. Shows the route on a map after.

**AI diagnostics** — this is the part that started the whole thing. You pick your bike, select symptoms (sounds, sensations, visual stuff), optionally add photos, and it analyzes what might be wrong. It pulls in your maintenance history too so it has context. Not a replacement for a mechanic — but it gives you a starting point so you don't show up completely clueless.

**Garage management** — multiple bikes, each with their own maintenance schedule and expense history.

I'm a software engineer by day, so I built this myself. The whole thing took about 5 days of focused work. It's free on the App Store.

If any of you ride — [motovault.app](https://motovault.app/). Would love to hear what you think or what features would be useful.

---

## IF POSTING AS VIDEO:

Use the same screen recording from the r/expo post. Post body can be shorter:

My bike broke down on a trip and I had no clue what was wrong. Googled symptoms, got nowhere. So I built an app.

[MotoVault](https://motovault.app/) — motorcycle maintenance tracker, expense tracker, ride logger, and AI diagnostic tool. You tell it your symptoms, it tells you what might be wrong using your bike's maintenance history.

Built it in about a week. Free on the App Store. Details in comments if anyone's curious.

Then post the full text above as the first comment.

---

## Prepared follow-up comments:

**"how does the AI diagnostic work?"**
> You pick your bike from your garage, then select symptoms from categories — sounds (clicking, grinding, knocking), sensations (vibration, pulling, stalling), visual (leaks, smoke, wear). You can add photos too. It analyzes everything together and if you have maintenance history logged it uses that for context — like if your last oil change was 8000km ago it factors that in. Gives you a ranked list of possible issues with explanations. It's not perfect but it's way better than my previous approach of panicking and googling random forum posts.

**"what bikes do you have?"**
> Two BMWs — they're the ones in my garage in the app. I'm honestly not great with the mechanical side which is exactly why I built this. I can ride them but ask me to diagnose a weird noise and I'm lost.

**"is it free?"**
> Yeah, free to download and use. The core features — maintenance tracking, expenses, rides, garage, AI diagnostics — are all free.

**"what tech did you use?"**
> React Native with Expo for the mobile app, NestJS for the backend API, Supabase for the database and auth, Claude AI for the diagnostic engine. If anyone's interested in the technical side I can go deeper but didn't want to make this post too techy.

**"can you add [feature]?"**
> Drop it here — I'm actively working on it and rider feedback is exactly what I need. Already planning ride logging with live GPS and a heads-up display for the next update.
