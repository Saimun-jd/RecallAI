# 12 · Activity diagram: a student's study workflow

The main path through the app, from upload to spaced review, with the points where it branches. Red boxes are steps that fail in the current build (from Rony's testing and the code review).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
flowchart TD
    start((Start)) --> login[Log in]
    login --> key{AI provider<br/>set active?}
    key -- no --> settings[Add API key and press Set Active]
    settings --> upload
    key -- yes --> upload[Upload PDF / TXT / MD]
    upload --> scanned{Handwritten<br/>or scanned?}
    scanned -- yes --> marker[Analyze Handwriting Outline]
    marker --> nooutline[No topics produced<br/>Marker not installed]:::bad
    scanned -- no --> topics[Topics from table of contents]
    topics --> read[Read PDF, highlight, add notes]
    read --> choose{Choose activity}
    choose --> chat[Ask the chat]
    choose --> drill[Socratic drill]
    choose --> gen[Generate flashcards]
    choose --> quiz[Generate quiz]
    chat --> chatans[Answer from top 5 chunks]
    drill --> grade[Grade typed answer]:::bad
    grade --> save[Save weak points as cards]
    gen --> cards[(Flashcard deck)]
    save --> cards
    quiz --> take[Take quiz] --> score[Score shown]:::bad
    cards --> due{Cards due today?}
    due -- yes --> review[Review: Again / Hard / Good / Easy]
    review --> fsrs[FSRS sets next due date]
    fsrs --> due
    due -- no --> progress[View progress analytics]
    chatans --> choose
    score --> choose
    progress --> stop((End))

    classDef bad fill:#FBEBEB,stroke:#c0392b,color:#1f1f1f
    classDef default fill:#BFE3FD,stroke:#5b7fa6,color:#1f1f1f
```

Failing steps: handwriting analysis produces nothing, drill grading uses an empty prompt, and the quiz score display divides the wrong numbers.

SVG export: [12-activity-study-workflow.svg](12-activity-study-workflow.svg)
