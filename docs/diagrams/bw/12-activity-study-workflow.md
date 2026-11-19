# 12 · Activity diagram: a student's study workflow

The main path through the app, from upload to spaced review, with the points where it branches. Dashed boxes are steps that fail in the current build (from Rony's testing and the code review).

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "secondaryColor": "#ffffff", "secondaryBorderColor": "#000000", "tertiaryColor": "#ffffff", "tertiaryBorderColor": "#000000", "mainBkg": "#ffffff", "nodeBorder": "#000000", "lineColor": "#000000", "textColor": "#000000", "edgeLabelBackground": "#ffffff", "clusterBkg": "#ffffff", "clusterBorder": "#000000", "actorBkg": "#ffffff", "actorBorder": "#000000", "actorTextColor": "#000000", "actorLineColor": "#000000", "signalColor": "#000000", "signalTextColor": "#000000", "labelBoxBkgColor": "#ffffff", "labelBoxBorderColor": "#000000", "labelTextColor": "#000000", "loopTextColor": "#000000", "noteBkgColor": "#ffffff", "noteBorderColor": "#000000", "noteTextColor": "#000000", "activationBkgColor": "#ffffff", "activationBorderColor": "#000000", "sequenceNumberColor": "#ffffff", "labelBackgroundColor": "#ffffff", "compositeBackground": "#ffffff", "compositeTitleBackground": "#ffffff", "altBackground": "#ffffff", "transitionColor": "#000000", "transitionLabelColor": "#000000", "stateLabelColor": "#000000", "stateBkg": "#ffffff", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}}}%%
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

    classDef bad fill:#ffffff,stroke:#000000,stroke-width:2.5px,stroke-dasharray:6 4,color:#000000
    classDef default fill:#ffffff,stroke:#000000,color:#000000
```

Failing steps: handwriting analysis produces nothing, drill grading uses an empty prompt, and the quiz score display divides the wrong numbers.

SVG export (black and white): [12-activity-study-workflow.svg](12-activity-study-workflow.svg)
