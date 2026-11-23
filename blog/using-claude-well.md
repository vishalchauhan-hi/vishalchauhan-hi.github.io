---
title: How to use Claude well: notes from rebuilding my website.
date: 2026-11-26
summary: I rebuilt this site with Claude in a few days. Some of it went great, some of it I had to undo. Six things I would tell a colleague before they try.
tags: AI tools, human–AI interaction, web
cover: assets/images/blog/using-claude/home-after.jpg
cover_alt: The homepage after the rebuild, with the hand-drawn street under my name
---

I rebuilt this website with Claude over a few days. The site got faster, it got a blog, and it finally works on a phone. I also had to undo a few things it did with full confidence.

Drag the line to see where I started.

<div class="ba">
  <img src="assets/images/blog/using-claude/home-after.jpg" alt="The homepage after: same header and photo, plus a hand-drawn street where your cursor is the pedestrian" />
  <div class="ba-top"><img src="assets/images/blog/using-claude/home-before.jpg" alt="The homepage before the rebuild" /></div>
  <div class="ba-line"></div><div class="ba-knob">⇆</div>
  <span class="ba-tag l">before</span><span class="ba-tag r">after</span>
  <input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after" />
</div>

<p class="ba-cap">same photo, same words. the street underneath is new: your cursor is the pedestrian.</p>

Here is what I learned.

## 1. Give it real things, not adjectives

My first request was roughly “make it more engaging, less like AI”. What came back was polished and generic. Pill buttons, emoji, cards that lift when you hover.

It got good the moment I gave it real material: my photos, the CAD file of the smart pole, a sketch of the actual device, the technical drawing. Real things carry details that no description does.

![The 3D-printed ring frame of the smart pole, with the LED panel wrapped over it. I handed over this photo and the CAD file.](assets/images/making/printed-ring.jpg)

## 2. The prompts that actually worked

Short, plain sentences. None of them clever.

<ul class="stickies">
  <li class="sticky"><q>Show me first, don’t update.</q><small>It builds a preview somewhere safe. Nothing on the real site changes.</small></li>
  <li class="sticky"><q>Only add. Don’t change my text.</q><small>The one I wish I had said on day one.</small></li>
  <li class="sticky"><q>Here is the real thing.</q><small>A photo, a PDF, a drawing. Better than any description.</small></li>
  <li class="sticky"><q>Why is it slow?</q><small>It measured instead of guessing, and found 55 MB of photos.</small></li>
  <li class="sticky"><q>Check it on a phone.</q><small>That is how we found the menu that took up a fifth of the screen.</small></li>
  <li class="sticky"><q>Open a PR, don’t merge.</q><small>Every change waits for me to say yes.</small></li>
</ul>

## 3. It will be confident and wrong

At one point it rewrote the news on my homepage. It looked fine at a glance. It was not mine.

<div class="oops">
  <p class="oops-h">what changed without me asking</p>
  <p class="diff">… as the <del>single</del> <ins>sole</ins> Principal Investigator …<br>+ two lines under my name that I never wrote<br>+ my sections pushed below new ones</p>
  <p>Nothing was lost, because everything lives in git. But I only noticed because I looked. Now I compare my own text before and after every change, and a check does it for me.</p>
</div>

The lesson is not “don’t trust it”. It is: decide in advance what it is not allowed to touch, and say it.

## 4. Ask it to measure

“The site feels slow” is a feeling. Claude turned it into numbers: the publications page alone loaded 28 MB of images, because the paper figures were uploaded at print size. After shrinking them it was 246 KB. Same pictures, same filenames.

The phone menu was the same story. On the left, before: four rows of links eating the top of every page. On the right, after: one row you can swipe.

<div class="phones">
  <figure class="phone"><div class="frame"><img src="assets/images/blog/using-claude/phone-before.jpg" alt="Phone view before: the menu wraps into four rows" /><div class="measure" style="--h:43%"></div></div><figcaption>before · 4 rows, 165 px</figcaption></figure>
  <figure class="phone good"><div class="frame"><img src="assets/images/blog/using-claude/phone-after.jpg" alt="Phone view after: one swipeable menu row" /><div class="measure" style="--h:23%"></div></div><figcaption>after · 1 row, 87 px</figcaption></figure>
</div>

## 5. Build a safety net once

Every change now goes through a pull request. Automatic checks run on it: broken links, missing images, photos that are too big, pages that don’t match. GitHub refuses to merge until they pass. It took an afternoon to set up, and it means a bad change can’t quietly reach the live site.

## 6. Remember that it forgets

A new conversation starts from zero. So the rules live in writing: a short file in the project, and a few saved notes like “never delete or reword what I wrote”. Say it once, write it down, stop repeating yourself.

## The short version

Treat it like a fast, eager colleague who has never seen your field. Give it real material. Ask to see before it changes anything. Check its work, especially the parts that look fine.

It saved me days. It also reminded me why I study how people come to trust machines: trust grows when a system shows what it is about to do, lets you undo it, and knows its limits.
