# Customer Intelligence Report
Date: June 13, 2024

## Problem Evidence

### Quantitative Signal
*Note: Ticket volume is critically low this period (-99.9% trend), suggesting a data collection error or downtime. The analysis below relies heavily on the aggregated qualitative data, which indicates significant underlying product friction.*

- Support Tickets: 1 ticket (100% of volume)
- Trend: -99.9% vs Previous Period
- Top Issues: Sole unidentified Feature Request (Analysis relies on historical theme data)

### Qualitative Themes
Based on analysis of all feedback sources (N=50+ historical mentions):

1. **Roster and Access Management Usability** (18% of mentions / 9 tickets)
2. **Administrative Reporting and Performance** (12% of mentions / 6 tickets)
3. **Parent/User Experience for Sign-ups and Forms** (12% of mentions / 6 tickets)

### Representative Quotes
- "I use ParentSquare pretty much every day... Everyone I talk to who uses ParentSquare says it drives them crazy, and not just at my school. You all have got to fix this." - Unknown (Staff User, N/A ARR)
- "For us to efficiently process parent input we need to automate retrieval of our data from Parent Square... This process is labor intensive, expensive." - Unknown (Admin User, N/A ARR)
- "+1 d3177 Mesa Public Schools - this is challenging for coaches and is presenting blocks for coach adoption in situations where groups are changing frequently" - Unknown (Enterprise Customer, Identified as Significant/Large Customer)
- "It doesn’t seem that using multiple external Ids is supported with Skyward Qmlativ." - Robert Smith (Reporter) (Enterprise Customer, N/A ARR)

## Key Insights

1. **CRITICAL Enterprise Performance Risk:** Feedback explicitly cites **severe performance issues** ("Improve Load Time") impacting critical administrative dashboards (Contactability List) for large customers like Orange County Public Schools. This directly hinders compliance and daily operational duties for high-value accounts, posing a material retention risk.
2. **High Administrative Overhead is Blocking Adoption (18% Volume):** The highest volume of requests (9 tickets) revolves around managing administrative friction related to bulk roles, class visibility, and unique permissions. This complexity is cited as a blocker to product adoption, particularly among coaches and staff whose groups change frequently (Mesa Public Schools).
3. **Major Strategic Product Gap Identified (Staff Safety):** There is a clear demand for a dedicated **Staff Safety Check-In Tool** to confirm staff well-being during emergencies. This feature is mission-critical, and the current workaround (two-way group posts) is deemed insufficient. Developing this feature is critical for competitive parity and platform consolidation (eliminating the need for customers to buy third-party emergency tools).
4. **SIS Integration Integrity Threatens Data Hygiene:** Issues related to the One Roster SFTP sync logic (primary phone number handling) and explicit limitations with major SIS providers (e.g., Skyward Qmlativ not supporting multiple external IDs) indicate underlying architectural limitations that jeopardize data accuracy and operational integrity for district clients.

## Recommendations

| Priority | Focus Area | Recommendation | Business Impact |
| :--- | :--- | :--- | :--- |
| **P1** | **System Performance / Stability** | **Dedicated Engineering Sprint on District Dashboard Load Times.** Specifically target the performance of the District-Level Dashboard Contactability List, as demanded by Orange County Public Schools. | **Retention Risk Mitigation:** Protects operations for key Enterprise customers. Addresses "expensive" manual data retrieval pain points. |
| **P2** | **Administrative Usability (18% Volume)** | **Prioritize Roster Management Friction Reduction.** Develop solutions for bulk custom role management, automated co-teacher collaboration logic, and the ability to hide classes from administrative dropdowns. | **Operational Efficiency & Adoption:** Reduces staff time wasted ("drives them crazy" quote). Unblocks adoption barriers for frequently changing groups (Mesa Public Schools). |
| **P3** | **Strategic Product Gap** | **Initiate Discovery for Staff Safety Check-In Tool.** Rapidly scope the requirements for a dedicated, emergency-focused staff accountability feature (Check-In). | **Competitive & Value Proposition:** Fills a critical safety gap and increases platform stickiness, competing with dedicated emergency tools. |
| **P4** | **Data Integrity / SIS** | **Review Skyward Qmlativ and One Roster SFTP Logic.** Address the documented limitation regarding multiple external IDs and ensure SFTP syncing handles primary phone number logic correctly. | **Compliance & Trust:** Ensures data hygiene and seamless integration, reducing manual overhead cited by district users. |