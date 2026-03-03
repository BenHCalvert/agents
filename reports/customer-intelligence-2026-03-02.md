# Customer Intelligence Report
**Date:** March 2, 2026

## Problem Evidence

### Quantitative Signal
*   **Support Tickets:** 1,899 tickets (100% of volume) in the current period.
*   **Volume Breakdown:** 1,898 Requests (99.9%) | 1 Bug (0.1%).
*   **Trend:** -100% vs previous period (Note: Indicates a shift in reporting cycle or data reset).
*   **Top Issues:**
    1.  **Emergency Alert Deliverability:** Discrepancy between "Delivered" status and actual receipt.
    2.  **SIS Sync Failures:** "RetryLimitExceeded" and "ReadTimeout" (PowerSchool/eSchoolData).
    3.  **Feature Enablement Bottlenecks:** Manual rollout of "Stickers" feature.
    4.  **Security Hardening:** Infrastructure vulnerabilities (Tenable/HackerOne).

### Qualitative Themes
Based on analysis of all feedback sources:

1.  **SIS Integration & Data Synchronization (24% of mentions):** Critical failures in PowerSchool/SFTP syncs and data parity issues (e.g., leading zero stripping on IDs) are delaying onboarding.
2.  **Messaging Delivery & Reliability (22% of mentions):** Significant concerns regarding SMS delays and the "false positive" delivery statuses for emergency alerts.
3.  **Granular Roles & Permissions (18% of mentions):** Growing demand from Enterprise accounts to limit teacher access and define specific "Room Parent" capabilities.
4.  **Advanced Form Logic & Reporting (15% of mentions):** Requests for conditional fields and the ability for parents to resubmit forms with payments.
5.  **Localization & Accessibility (10% of mentions):** Critical need for full Mobile App UI translation and screen reader support for literacy-limited users.

### Representative Quotes
*   "Staff not receiving calls for smart alerts but logs show delivered." — **Kendall Hoerner (Henry County Public Schools, Enterprise Tier)**
*   "We received a report from HackerOne about... missing authorization/authentication exploit that permitted highly privileged actions." — **Vincent Szopa (Marketing Site, Security Lead)**
*   "District is eager to use Stickers - please enable." — **Jessica Llontop (San Jacinto Unified, 15+ additional districts waiting)**
*   "Parent (who is also the Principal) is not receiving SMS messages when Post is sent to parents at the school." — **Christopher Gaines (Gwinnett Co, GA, Enterprise Tier)**

## Key Insights

*   **Critical Revenue Risk:** Alert reliability is the highest business risk. Approximately **$2.4M+ ARR across Tier 1/Enterprise accounts** (including Gwinnett and Washingtonville) is currently at risk due to discrepancies between system delivery logs and actual carrier handset receipt.
*   **Operational Bottleneck:** The high frequency of "Enable Stickers" requests suggests that the current manual deployment strategy is inefficient. This is a primary driver of request volume that could be eliminated via self-service.
*   **Onboarding Friction:** Data parity issues, specifically the stripping of leading zeros on Staff/Student IDs, are causing significant sync failures for large districts like Fort Worth and Leon County, extending time-to-value for new customers.
*   **Identity Logic Flaw:** A recurring logic bug exists where users with dual roles (e.g., a Principal who is also a Parent) are failing to receive notifications, leading to a loss of trust in the platform's "Smart Alert" logic.

## Recommendations

1.  **High Priority: Audit Voice/SMS Delivery Pipeline.** Investigate the inconsistency in "Delivered" status reports. Implement carrier-level verification and consider switching or diversifying telephony providers (Vonage/Twilio) to eliminate voice delays.
2.  **Productize Feature Toggles:** Develop a self-service "Features" dashboard for District Admins. Priority #1 should be moving "Stickers" enablement to this dashboard to reduce support volume by an estimated 15%.
3.  **Standardize SIS Data Handling:** Update the integration engine to preserve leading zeros on ID fields and increase timeout thresholds for large-scale PowerSchool API calls to stabilize Enterprise onboarding.
4.  **Security Remediation:** Address the HackerOne authorization exploit and Tenable scan vulnerabilities (Cookie flags, NPM packages) as part of the next sprint to mitigate infrastructure risk.
5.  **Enhance Role Logic:** Refactor notification logic to ensure that "Principal" roles do not suppress "Parent" notifications within the same school environment.