# Piano Operativo Aggiornato: LinkedIn Grow (Relationship Intelligence)

Questo documento definisce la roadmap strategica integrando la **Data Collection Strategy** con le **Personas**. L'obiettivo primario è mappare le interazioni reali per fornire intelligence sulle relazioni e sui trend, non solo supporto al copywriting.

---

## 🎯 Allineamento Personas-Funzionalità

| Persona | Focus Tecnico | Feature Strategica | Obiettivo |
| :--- | :--- | :--- | :--- |
| **🌱 Esploratore** | Ingestion Passiva | **Feed Observer (Total)** | Mappare l'ecosistema senza richiedere click all'utente. |
| **🧗 Scalatore** | Networking & Orbiting | **Relationship Weighting** | Calcolare la forza dei ponti tramite menzioni e tag. |
| **🕷️ Il Ragno** | Intelligence | **Trend & Cluster Engine** | Vedere pattern di mercato e alleanze prima che emergano. |

---

## 🛠️ Roadmap Evolutiva (Fasi di Sviluppo)

### Fase 1: Ingestion Totale & Warm-up (Focus: Esploratore)
*Obiettivo: Nutrire il grafo con dati passivi per eliminare il problema del database vuoto.*

1.  **Feed Observer (Silenzioso)**:
    - Implementare `IntersectionObserver` nel plugin.
    - Tracciamento `post_viewed` per ogni post visibile >2s.
    - **Data Enrichment**: Cattura sistematica della **Headline/Tagline** per ogni autore e co-commentatore incontrato.
    - **Valore**: Mappa le persone che gravitano nell'orbita dell'utente anche senza interazione diretta.
2.  **Maturità del Grafo**:
    - Dashboard che mostra il "Loading" del valore reale: una volta raggiunto il target di nodi, si sbloccano le feature avanzate.

### Fase 2: Semantica & Orbiting (Focus: Scalatore)
*Obiettivo: Capire di cosa parla la rete e chi sono i veri "connettori".*

1.  **Tag & Hashtag Mapping**:
    - Parsing automatico di `@mentions` (relazione `:MENTIONED_IN`) e `#hashtags` (nodo `:Topic`).
    - **Relationship Weight**: L'IA assegna un peso più alto ai "ponti" tra persone che si taggano spesso.
2.  **Orbiting Assistito**:
    - L'IA suggerisce: *"Per farti notare da [Target], dovresti interagire con [B], visto che [B] è stato taggato in 3 post di [Target] questa settimana"*.
3.  **AI Copy con Menzioni**:
    - Suggerimento di citare contatti rilevanti nei commenti generati per aumentare la visibilità.

### Fase 3: Intelligence & Cluster Detection (Focus: Il Ragno)
*Obiettivo: Da "chi conosci" a "cosa sta succedendo nel mercato".*

1.  **Trend Engine**:
    - Aggregazione degli hashtag e dei temi più caldi nel feed visualizzato (non solo quello suggerito da LinkedIn).
    - Alert: *"Il tuo network sta virando verso il tema [Topic X]"*.
2.  **Cluster & Policy Detection**:
    - Rilevamento di gruppi di persone che iniziano a interagire tra loro (possibili deal, nuove startup o spostamenti di team).
    - **Bridge Analysis Passivo**: Monitorare chi sta cercando di raggiungere chi nel network visibile (competitor intelligence).
3.  **Filtraggio AI del Feed**:
    - Un'interfaccia dashboard che riordina i post visualizzati non per "engagement" ma per "rilevanza strategica" rispetto ai target salvati.
4.  **Strategic Prospecting & Multi-hop Orbiting**:
    - **Esplorazione Profonda**: Estensione della mappa oltre il 2° grado (fino al 3° o 4° grado di "ponte") per scovare opportunità inesplorate ma raggiungibili.
    - **Targeting per Headline**: Filtraggio e ricerca avanzata dei target basata sulla Headline professionale (catturata durante la fase di ingestion).
    - **Pruning & Weighting**: Utilizzo del Relationship Weighting come filtro critico per eliminare il rumore dei percorsi multi-grado, seguendo solo le "scie" di interazione realmente calde.
    - **Strategic Ranking**: Ordinamento dei target suggeriti incrociando la forza del percorso sociale con il valore strategico del ruolo professionale del target.

---

## ⚙️ Modifiche Architetturali Richieste

- **Neo4j Schema**:
    - Nodi: `:Topic`, `:Person` (con proprietà `headline`), `:Post`, `:Action`.
    - Relazioni: `:HAS_TOPIC`, `:MENTIONS`, `:AMPLIFIED` (Like/Comment).
- **Processing Layer**:
    - Data Ingestion: Update `feed-observer.js` per catturare selettori CSS della tagline sotto i nomi utente.
    - Worker: Calcolo periodico della forza dei legami (Relationship Score) basandosi sulla frequenza di interazioni e menzioni.
- **AI Layer**:
    - Prompt per l'estrazione dei temi (Topic Extraction) e per il suggerimento di strategie di "Orbiting".

---

## 📅 Azioni Immediate
1. [ ] Sviluppo `IntersectionObserver` per plugin.
2. [ ] Backend: Update `event-service` per parsing Hashtag/Tag.
3. [ ] Dashboard: Tab **Trend** iniziale basata sui Topic estratti.

---

## 📝 Changelog

### 2026-03-03
- **Integrazione Strategic Prospecting**: Aggiunta specifica per esplorazione del grafo oltre il 2° grado (Multi-hop).
- **Enrichment Tagline**: Introdotto l'obbligo di cattura della `headline` professionale per ogni nodo `:Person` per abilitare filtri basati sul ruolo (CEO, Founder, etc.).
- **Relationship Weighting (Trigger)**: Ottimizzazione del worker tramite "dirty flag" su Redis per minimizzare il carico su Neo4j.
- **AI Orbiting API**: Implementazione dell'endpoint di strategia AI integrato nella dashboard.
