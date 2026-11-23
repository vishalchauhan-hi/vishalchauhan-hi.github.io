---
title: Your title here.
date: 2026-12-01
summary: One sentence that appears in the Blog list.
tags: topic one, topic two
cover: assets/images/blog/your-post/cover.jpg
cover_alt: What the cover photo shows
---

How to use this template:
1. Copy this file to blog/your-post.md (no "_" at the start, or it won't be published).
2. Put your photos in assets/images/blog/your-post/ and run:
   python3 tools/optimize-images.py assets/images/blog/your-post/*.jpg
3. Write below, then run: node scripts/build-blog.mjs
   Delete these instructions. "cover:" is optional (remove both cover lines for no cover photo).

Write a paragraph like this. Leave an empty line between paragraphs.
Use **bold**, *italic* and [a link](https://example.com).

## A heading

One picture, full width. The text in [ ] becomes the caption:

![Presenting at CIV 2026 in Miyazaki](assets/images/blog/your-post/talk.jpg)

Two or three pictures on lines right after each other sit side by side:

![The pole on the street](assets/images/blog/your-post/street.jpg)
![Participants at the crossing](assets/images/blog/your-post/people.jpg)

> A quote or a key sentence you want to stand out.

- A list item
- Another item
