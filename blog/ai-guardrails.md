---
title: How I stopped an AI from rewriting my website.
date: 2026-11-23
summary: An AI assistant redesigned my homepage and quietly replaced my own words. Here are the four layers I now use so it can add, but never erase.
tags: human–AI interaction, trust, tools
---

I asked an AI coding assistant to make my academic website more engaging. It did a lot well: it shrank the site’s images from 55 MB to 4.5 MB and added real photos and hand-drawn figures. It also replaced the news I had written on my homepage with different wording, added two lines under my name that I never wrote, and pushed my own sections below new ones.

Nothing was lost for good, because everything lives in git. But it felt wrong: a tool that was supposed to help me had quietly started speaking for me. As someone who studies how people come to trust machines, I found that uncomfortably familiar.

## Four layers, from soft to hard

Inspired by [Danyel Koca’s post](https://www.danyelkoca.com/en/blog/claude-code-settings), I now protect the site in four layers. Each one catches what the one above misses.

<div class="layers">
  <div class="layer"><span class="layer-n">1</span><h3>A rules file</h3><p>A note the AI reads first: <em>never delete or reword my writing; add after it.</em></p><p class="layer-s">soft — it can be ignored</p></div>
  <div class="layer"><span class="layer-n">2</span><h3>What I say</h3><p>“Show me first, don’t update.” Clear, but forgotten in the next chat.</p><p class="layer-s">soft — doesn’t last</p></div>
  <div class="layer"><span class="layer-n">3</span><h3>Permissions</h3><p>What the AI may do freely, must ask about, or can never do, enforced by the tool.</p><p class="layer-s">hard — can’t be overridden</p></div>
  <div class="layer"><span class="layer-n">4</span><h3>A lock on my words</h3><p>A check fingerprints 96 pieces of my writing. Adding passes; changing or deleting fails.</p><p class="layer-s">a wall</p></div>
</div>

## The lock, catching the real mistakes

I replayed the three things that had actually happened on a copy of the site. The check stopped all three and showed exactly which words changed:

<figure class="term">
  <div class="term-bar"><span></span><span></span><span></span> node scripts/protect-sections.mjs</div>
<pre>✗ CHANGED  home: hero text
     now: "… Smart Cities &amp; Urban Mobility <mark>I study how self-driving cars…</mark>"
✗ CHANGED  home news: Sep 2026
     was: "… as the <mark>single</mark> Principal Investigator…"
     now: "… as the <mark>sole</mark> Principal Investigator…"
✗ REMOVED  moments photo: Presenting “A Silent Negotiator?”

3 piece(s) of Vishal's own writing were changed or removed.</pre>
  <figcaption>Adding a new news item, by contrast, passes: <em>“All 96 pieces of your writing are untouched. (1 new item added — fine.)”</em></figcaption>
</figure>

Only I can accept a change to my own text. The AI is not allowed to run that command for me.

## What it taught me about my own research

My work is about machines making their intent readable so people don’t have to guess. The same principle applies to AI tools: the help I trust is help that is **visible** (show me first), **reversible** (everything in git) and that **knows its limits** (some actions are simply not allowed). That isn’t about distrusting the AI. It’s about designing the interaction so trust can be earned.
