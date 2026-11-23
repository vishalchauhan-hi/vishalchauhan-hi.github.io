---
title: Using Claude Code well: a practical guide from Anthropic’s own docs.
date: 2026-11-26
summary: The official advice from Anthropic’s documentation and Claude Academy courses, condensed into one page, plus a prompt builder you can use right here.
tags: Claude Code, AI tools, how-to
---

I use Claude Code to build and maintain this website. This post collects what Anthropic itself recommends, from its documentation and its free Claude Academy courses, in one place. Every section links to the source. The prompt builder in the middle is something you can use right now.

> “Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools.” ([Claude Code docs](https://code.claude.com/docs/en/overview))

## The workflow: explore, plan, code, commit

Anthropic’s *Claude Code 101* course teaches one loop for any feature or task:

<ol class="flow">
  <li><b>Explore</b><span>Let Claude read the relevant files first. Point it at them with <code>@path</code>, paste screenshots or logs.</span></li>
  <li><b>Plan</b><span>Switch to plan mode (<code>Shift+Tab</code>). It researches and proposes, without editing anything.</span></li>
  <li><b>Code</b><span>Approve the plan, then let it build. Give it a check to run, like tests or a build.</span></li>
  <li><b>Commit</b><span>Review the diff, then commit. Small steps are easy to review and easy to undo.</span></li>
</ol>

Plan mode is worth knowing by name. In the docs’ words: “Plan mode tells Claude to research and propose changes without making them.” ([Permission modes](https://code.claude.com/docs/en/permission-modes))

## Writing a good request

The prompting guide starts with one picture: “Think of Claude as a brilliant but new employee who lacks context on your norms and workflows.” A good test is to show your request to a colleague with no context. If they would be confused, so will Claude. ([Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices))

The guide’s main points:

- **Be clear and direct.** Say exactly what you want, not just the topic.
- **Explain why.** Claude can generalize from the reason. Instead of a bare rule, say what it protects.
- **Show examples.** A few relevant, varied examples work better than long descriptions.
- **Use XML tags** to separate parts: instructions, context, material.
- **Say what to do, not what to avoid.** “Write in flowing paragraphs” works better than “don’t use bullet points”.

Here is that advice as a tool. Start with *a vague request*, then *a good request*, and watch which parts light up.

<div class="pb" data-prompt-builder><p>The prompt builder needs JavaScript. The fields are: what you want, why and for whom, the material, rules and limits, an example, and the output format.</p></div>

Nothing you type here is sent or saved anywhere. Copy the result into Claude.

## Claude Code habits from the official best practices

These come from Anthropic’s [Claude Code best practices](https://code.claude.com/docs/en/best-practices) page.

**Be specific about the problem.** Their example: instead of “fix the login bug”, write “users report login fails after the session times out. look at token refresh in src/auth/, write a failing test that reproduces it, then fix it”.

**Hand over what you already have.** A file with `@path`, a screenshot pasted into the chat, or an error log piped straight in:

```
cat error.log | claude -p "what's going on here"
```

**Give Claude a check to run.** “Give Claude something it can run that comes back pass or fail”: tests, a build, a linter, a screenshot next to the design. Then ask for the command it ran and the output, not just “done”.

**Steer early.** “Watch the first minute”, press `Esc` the moment it drifts, and if the same correction fails twice, start fresh with `/clear` and a better prompt. `/rewind` rolls back code, conversation or both.

**For big tasks, let it interview you first.** “Interview me until you could write the spec, then write it to SPEC.md”, then build from that file in a new session.

## CLAUDE.md: the project’s memory

“CLAUDE.md files are markdown files that give Claude persistent instructions for a project, your personal workflow, or your entire organization.” ([Memory docs](https://code.claude.com/docs/en/memory))

- Run `/init` to create a first version, then keep it short. The docs suggest under 200 lines.
- Put in what Claude cannot guess: how to test and build, decisions that aren’t written anywhere else, and “anything you’ve had to correct twice already”.
- Rules that must never be broken belong in hooks or permission deny rules, which Claude cannot ignore, not only in CLAUDE.md.

<div class="callout"><p><b>What you can stop doing</b>, according to the same best-practices page: writing rules in ALL CAPS or IMPORTANT, describing your whole architecture in CLAUDE.md, and typing “think hard”. That phrase is now ordinary text. Use <code>/effort</code> to control how much it reasons.</p></div>

## Where to learn more

All free, from Anthropic:

<ul class="sources">
  <li><a href="https://academy.claude.com/courses/claude-code-101">Claude Code 101</a>: the explore, plan, code, commit workflow, context, CLAUDE.md, subagents, skills, MCP and hooks.</li>
  <li><a href="https://academy.claude.com/courses/claude-code-in-action">Claude Code in Action</a>: steering long sessions, verification, permission modes, hooks, headless runs and GitHub Actions.</li>
  <li><a href="https://academy.claude.com/courses/claude-101">Claude 101</a>: getting better results from Claude in everyday work.</li>
  <li><a href="https://code.claude.com/docs/en/best-practices">Claude Code best practices</a> and <a href="https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices">prompting best practices</a>: the two pages this post leans on most.</li>
  <li><a href="https://github.com/anthropics/prompt-eng-interactive-tutorial">Prompt engineering interactive tutorial</a>: nine hands-on chapters, from basic structure to complex prompts.</li>
</ul>

Sources checked on 23 November 2026. Tools change quickly, so when in doubt, the official docs win.
