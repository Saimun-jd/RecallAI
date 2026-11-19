# 14 · Gantt chart: team plan

Team of four: **Turjo** (team lead, frontend), **Saimun** (project idea, backend), **Tahsin** (database, testing, docs), **Rony** (frontend support, testing, docs). The timeline is in project weeks, not calendar dates.

```mermaid
%%{init: {"theme": "base", "themeVariables": {"background": "#ffffff", "primaryColor": "#BFE3FD", "primaryTextColor": "#1f1f1f", "primaryBorderColor": "#5b7fa6", "lineColor": "#555555", "sectionBkgColor": "#F4F8FC", "altSectionBkgColor": "#ffffff", "taskBkgColor": "#BFE3FD", "taskBorderColor": "#5b7fa6", "taskTextColor": "#1f1f1f", "taskTextDarkColor": "#1f1f1f", "taskTextOutsideColor": "#1f1f1f", "activeTaskBkgColor": "#E3CCFD", "activeTaskBorderColor": "#8e6cc0", "critBkgColor": "#FEC8C3", "critBorderColor": "#c98a84", "doneTaskBkgColor": "#C9F2D6", "doneTaskBorderColor": "#6fae86", "gridColor": "#e3e3e3", "fontFamily": "Segoe UI, Inter, Helvetica, Arial, sans-serif"}, "gantt": {"barHeight": 24, "fontSize": 13, "sectionFontSize": 14, "leftPadding": 260}}}%%
gantt
    title Recall AI: project plan (axis = project week number)
    dateFormat YYYY-MM-DD
    axisFormat W%W
    tickInterval 1week

    section 1 Planning
    Project idea and proposal (Saimun)              :done, p1, 2026-01-05, 1w
    Requirements and scope (Turjo, Saimun)          :done, p2, 2026-01-08, 1w
    Team roles and schedule (Turjo)                 :done, p3, 2026-01-12, 3d
    Planning complete                               :milestone, m1, 2026-01-16, 0d

    section 2 Design
    Backend architecture (Saimun, Turjo)            :done, d1, 2026-01-19, 2w
    Database design (Saimun, Tahsin)                :done, d2, 2026-01-19, 2w
    UI flows and screens (Turjo, Rony)              :done, d3, 2026-01-26, 2w
    Design complete                                 :milestone, m2, 2026-02-06, 0d

    section 3 Implementation
    Database schema and migrations (Tahsin, Saimun) :done, i1, 2026-02-09, 3w
    Backend API and services (Saimun)               :done, i2, 2026-02-09, 6w
    AI features - chat, drill, cards, quiz (Saimun) :done, i3, 2026-03-02, 5w
    Frontend app (Turjo, Rony)                      :done, i4, 2026-02-09, 7w
    Desktop packaging with Tauri (Turjo)            :done, i5, 2026-03-23, 2w
    Integration and fixes (Turjo, Saimun)           :done, i6, 2026-03-30, 2w
    Feature complete                                :milestone, m3, 2026-04-10, 0d

    section 4 Testing
    Real-user testing (Rony, Tahsin)                :active, t1, 2026-04-13, 2w
    Code review and bug hunt (Rony)                 :active, t2, 2026-04-20, 1w
    Bug fixing (Turjo, Saimun)                      :crit, t3, 2026-04-27, 2w

    section 5 Documentation and delivery
    Test reports and comparison report (Rony, Tahsin) :active, c1, 2026-04-20, 2w
    SE diagrams (Rony)                              :active, c2, 2026-04-27, 1w
    Final report and presentation (all)             :c3, 2026-05-04, 1w
    Submission                                      :milestone, m4, 2026-05-08, 0d
```

Colours: green = done, purple = in progress, pink = critical (bug fixing must finish before submission), blue = upcoming.

SVG export: [14-gantt-team-plan.svg](14-gantt-team-plan.svg)
