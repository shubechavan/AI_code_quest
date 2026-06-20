**BHARAT ACADEMIX CODEQUEST 2026** 

**==> picture [54 x 32] intentionally omitted <==**

**----- Start of picture text -----**<br>
DS<br>**----- End of picture text -----**<br>


**DarkSentinel AI** Explainable Financial Crime and Risk Intelligence Platform **AI and ML FinTech Cybersecurity** Co) OD) T E A M D A R K S E N T I N E L Deven Mahajan Akshat Kumar Shubham Chavan 

## **Problem Statement** 

Why current AML systems fail at scale in the Indian financial ecosystem 

**The Scale:** Indian financial institutions process an enormous and growing volume of UPI, NEFT, RTGS and card transactions every month. Existing rule based monitoring systems evaluate each transaction in isolation against static thresholds, with no ability to learn, adapt or explain their decisions. **1 2 3 Detection Gap Explainability Gap Access Gap** Rule based systems evaluate transactions one at a time. When a transaction is flagged, analysts receive only a Enterprise grade AML platforms such as NICE Actimize, They cannot detect coordinated multi account schemes, rule code or threshold name, with no reasoning about Oracle FCCM and SAS AML carry licensing costs that layering structures or novel laundering patterns without which factors made it suspicious or how it compares to place them completely out of reach for small FinTechs, manual rule updates. normal behaviour. cooperative banks and microfinance institutions. _Results in extremely high false positive alert volumes that Every investigation starts from scratch, producing investigation The institutions most vulnerable to financial crime end up with overwhelm analyst queues, and real financial crime passes paralysis and inconsistent decisions between analysts. the weakest monitoring infrastructure. through undetected._ **Net Result:** Large institutions are over alerted with false positives, small institutions remain under protected due to cost, and in both cases analysts make critical decisions with ~~[Mhine]~~ inadequate information. 

## **Proposed Solution** 

A four layer analytical stack where each layer feeds grounded, computed data into the next **Layer 1 Adaptive Risk Scoring Engine Layer 2 Graph Intelligence Engine** ‣ XGBoost gradient boosted classifier trained on PaySim and IEEE CIS datasets ‣ Transactions modelled as a directed graph where accounts are nodes and transfers are ‣ Over 25 engineered features covering transaction, behavioural and network signals edges ‣ Class imbalance handled with SMOTE applied to the training set only ‣ Computes degree, betweenness and eigenvector centrality for every account ‣ Isotonic Regression calibration so the output score reflects true probability ‣ Detects community structures to identify coordinated account clusters ‣ A parallel Isolation Forest model performs unsupervised anomaly detection ‣ Finds shortest paths between an account and any known sanctioned entity ‣ Composite score combines the supervised and anomaly scores into one result ‣ Flags structural patterns consistent with money mule behaviour ‣ All graph derived signals feed back into the composite risk score ~~Ef~~ **Layer 3 SHAP Grounded Explainability Layer 4 LLM Powered Investigation Brief** ‣ SHAP TreeExplainer computes the exact contribution of every feature to a prediction ‣ Claude API receives only the SHAP attributions, graph results and sanctions outcome ‣ Attribution is mathematically derived and unique to each transaction, not a template ‣ The model is explicitly instructed to narrate findings, not invent its own risk assessment ‣ Analysts see precisely which features pushed the score up or down, and by how much ‣ Cannot hallucinate a risk factor that was not first identified by the ML and graph layers ‣ Replaces analyst guesswork with structured, defensible evidence ‣ Produces a structured brief covering risk summary, contributing factors, network ‣ Forms the grounded input that the LLM layer is allowed to narrate concerns, sanctions status, recommended action and confidence notes ‣ Makes every decision traceable back to a specific numerical attribution ‣ Designed to remove repetitive manual write up work from the analyst workflow ‣ Output is auditable, since every sentence maps back to a computed input a 

## **System Architecture** 

Microservices design with async ML pipeline, role based access and tenant isolation 

**CLIENT LAYER** React SPA (Vite, Tailwind, React Flow, Recharts)   |   Role based views for Analyst, Risk Manager and Admin   |   Real time alerts via WebSocket re 

HTTPS 

**API GATEWAY JWT RS256 Rate Limiter Tenant ID Audit Log WebSocket Request (Node.js + Auth + RBAC (per IP/tenant) Injection Writer Server Router Express) Ingest Service Alert Mgmt Service ML Scoring Service Graph Service Sanctions Service** ‣ Validates schema ‣ Alert state machine ‣ XGBoost + calibration ‣ NetworkX directed graph ‣ OFAC + UN list index ‣ Assigns transaction id ‣ Tracks SLA per alert ‣ SHAP TreeExplainer ‣ Centrality metrics ‣ Jaro Winkler matching ‣ Writes to MongoDB ‣ SAR filing status ‣ Isolation Forest score ‣ DBSCAN clustering ‣ Confidence scoring ‣ Pushes to score queue ‣ Assigns to analyst ‣ 25+ feature pipeline ‣ Mule account flags ‣ Result caching ‣ Composite score calc **Report Generation Service:** assembles SHAP, graph and sanctions context, calls the Claude API, **Async Design:** Transactions enter a queue before scoring, so the ML service never blocks the API returns a structured investigation brief with PDF export. gateway, avoiding the bottleneck of synchronous calls under high transaction volume. Ltitt **transactions alerts accounts audit_logs sanctions_cache model_metrics users DATA LAYER** indexed: account, time, score state machine, SAR status indexed: account, tenant immutable, long retention OFAC + UN, timed cache performance over time hashed creds, roles, tenant **MongoDB** 

**transactions alerts accounts audit_logs sanctions_cache model_metrics users** indexed: account, time, score state machine, SAR status indexed: account, tenant immutable, long retention OFAC + UN, timed cache performance over time hashed creds, roles, tenant LIL 

## **Technology Stack** 

Every component selected for correctness, scalability and auditability, not convenience 

## **Frontend** 

React.js with Vite 

- ‣ 

‣ Tailwind CSS ‣ React Flow for graph visualisation 

‣ Recharts for analytics and SHAP waterfall charts 

‣ Role based dashboard views 

‣ WebSocket client for live alerts 

## **API Gateway** 

‣ Node.js with Express ‣ JWT RS256 with refresh rotation 

- ‣ Role based access 

control middleware ‣ Helmet.js security headers 

‣ Per IP and per tenant rate limiting 

‣ Tenant isolation enforcement 

## **ML Service** 

‣ Python with FastAPI ‣ XGBoost fraud classifier ‣ Isotonic Regression calibration 

‣ SHAP TreeExplainer ‣ Isolation Forest anomaly detection ‣ NetworkX graph analytics 

## **Data Layer** 

‣ MongoDB with seven collections 

‣ ‣ collections ‣ Indexes on account, time ‣ and risk score ‣ Time to live indexes for ‣ retention policy ‣ PaySim and IEEE CIS ‣ training data ‣ OFAC and UN sanctions ‣ index 

‣ Model performance ‣ metrics store 

## **LLM and Reports** 

Claude API for narrative generation 

Strictly grounded prompting design Structured multi section brief output 

PDF export of investigation brief Report linked to alert in MongoDB Every call logged in audit trail 

## **Datasets and Training Approach** 

Each dataset is mapped to a specific model with a documented rationale **PaySim IEEE CIS Fraud Detection ULB Credit Card Fraud** _Approximately 6.3 million transactions Large scale, hundreds of features PCA transformed features_ **Role:** Secondary classifier and source of feature engineering **Role:** Used only to train the Isolation Forest anomaly model **Role:** Primary training data for the XGBoost fraud classifier ideas on normal transactions Mobile money simulation with transaction types CASH IN, Industry grade e commerce fraud dataset. Its velocity, device The extreme class imbalance makes it ideal for unsupervised CASH OUT, TRANSFER and PAYMENT that closely mirror UPI and email domain feature patterns are adapted into the anomaly detection trained on the majority class. It is and NEFT patterns. Also used to build the sender to receiver engineered feature pipeline. deliberately not used for the supervised classifier because PCA transaction graph. transformed features would make SHAP attributions meaningless. **OFAC SDN List UN Consolidated Sanctions List FATF High Risk Jurisdictions** | _Large entity and alias index International coverage Country level risk tiers_ __ **Role:** Primary sanctions screening source **Role:** Supplements OFAC for non US designations **Role:** Country risk feature in the scoring model United States Treasury list with structured alias fields. Indexed Combined with OFAC to build a single merged sanctions index Countries on the high risk and increased monitoring lists in memory and matched using Jaro Winkler fuzzy similarity covering both United States and international designations. contribute a country risk adjustment to the composite score, across all aliases, not just primary names. reflecting real regulatory guidance. aa 

## **Expected Impact** 

Directional outcomes the design targets, to be measured once the system is built and evaluated 

_**Note:** These are design goals based on the architecture, not measured results. Actual figures will be produced after training, calibration and evaluation against the baseline comparison described below._ **Time Faster Investigation Filter Fewer False Positives Scale Higher Analyst Throughput** Each alert is intended to arrive with a pre built By replacing static thresholds with a calibrated probability Structured, auto generated reports are intended to let investigation brief, a SHAP attribution chart and graph score plus anomaly detection and network context, the each analyst review more alerts per day than with fully context, replacing the current practice of starting every system aims to reduce the proportion of alerts that turn manual investigation, since the repetitive write up work is investigation from a blank page. out to be false positives compared with a static rule based automated. baseline. ~~Ea~~ **EVALUATION FRAMEWORK (to be populated after training): System Detection Method Explainability Expected Direction** Static rule based threshold Fixed rules per field Rule name only Reference baseline Logistic regression on raw data Naive linear model on imbalanced data Coefficient weights, not per case Expected to underperform due to imbalance DarkSentinel calibrated XGBoost Calibrated probability plus anomaly and graph signals Per transaction SHAP attribution Target: improved precision recall trade off and lower false positive rate, measured after evaluation ~~——————~~ 

## **Project Roadmap** 

A phased build plan moving from data and models through to a demo ready platform 

**Phase 1** 

**Data and Model Foundation** 

‣ Download and explore PaySim and supporting datasets ‣ Build the feature engineering pipeline (25+ features) 

‣ Time based train, validation and test split to avoid leakage ‣ Train XGBoost with SMOTE and calibrate with Isotonic Regression 

‣ Train Isolation Forest on normal transactions only ‣ Integrate SHAP TreeExplainer and verify attributions 

**Phase 2** 

**Core Services** 

‣ Scaffold the monorepo and docker compose setup ‣ Build the Ingest Service with schema validation ‣ Build the ML Scoring Service exposing a score endpoint ‣ Build the Alert Management Service with its state machine ‣ Set up the seven MongoDB collections with indexing 

**Phase 3** 

**Graph and Sanctions Intelligence** ‣ Build the NetworkX based Graph Service ‣ Implement centrality metrics and DBSCAN clustering ‣ Parse OFAC and UN sanctions lists into a merged index ‣ Implement Jaro Winkler fuzzy matching with caching ‣ Wire graph and sanctions outputs into the composite score 

**Phase 4** 

**Gateway, Dashboard and Security** 

‣ Build the Node.js API Gateway ‣ with JWT and RBAC ‣ Implement rate limiting and ‣ tenant isolation ‣ Build the React dashboard for ‣ all three personas ‣ Add the SHAP waterfall chart ‣ and graph visualisation ‣ Apply Helmet, input validation ‣ and audit logging 

**Phase 5** 

**LLM Reports and Demo Preparation** 

Integrate the Claude API with a strictly grounded prompt Generate structured, multi section investigation briefs Add PDF export of the investigation brief 

Load a demo dataset and prepare showcase scenarios Record a walkthrough and prepare documentation 

