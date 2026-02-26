# 🚀 Roadmap: LinkedIn Intelligence & Future Insights

Il motore di Social Graph che abbiamo costruito è la base per analisi di profondità molto elevata. Ecco le idee per evolvere la raccolta dati e le query analitiche.

---

## 📊 1. Nuovi Dati da Raccogliere

Per rendere il grafo più "intelligente", dobbiamo arricchire i nodi esistenti.

### 🏢 Nodi Azienda (`:Company`)
*   **Azione:** Estrarre l'azienda attuale durante lo scan dei contatti o la lettura del feed.
*   **Proprietà:** Nome, Sito Web, Industry, Dimensione.
*   **Vantaggio:** Permette di mappare i "Power Account" (aziende dove hai più contatti o dove c'è più attività).

### 🤝 Collegamenti in Comune (Mutual Connections)
*   **Azione:** Quando si visita un profilo di 2° grado, scansionare chi sono i contatti comuni.
*   **Relazione:** `(Person)-[:KNOWS]->(Person)`.
*   **Vantaggio:** Rende la **Reach Map** precisa al 100%, mostrando i ponti reali invece di basarsi solo sui commenti.

### 🧠 Arricchimento AI (Sentiment & Topics)
*   **Azione:** Un worker in background analizza i post catturati dal plugin.
*   **Proprietà:** `post.sentiment` (Positive, Negative, Neutral) e `post.topics` (AI, Recruitment, Sales).

---

## 🔍 2. Nuove Query Avanzate

### 🌉 A. La query "Semiconduttore"
Trova i tuoi collegamenti che commentano il maggior numero di post di persone che **non conosci ancora**. Sono i tuoi migliori "moltiplicatori di portata".
```cypher
MATCH (me:User)-[:CONNECTED_TO]->(bridge:Person)-[:COMMENTED_ON]->(post:Post)
WHERE NOT (me)-[:CONNECTED_TO]->(:Person {slug: post.author_slug})
RETURN bridge.name, count(post) AS post_scoperti
ORDER BY post_scoperti DESC
```

### 📉 B. Engagement Gap (Stai perdendo opportunità?)
Identifica i collegamenti "VIP" (es. CEO o Investor) che pubblicano spesso ma con cui non hai ancora interagito.
```cypher
MATCH (u:User)-[:CONNECTED_TO]->(p:Person)<-[:AUTHORED_BY]-(post:Post)
WHERE p.headline CONTAINS "CEO" OR p.headline CONTAINS "Investor"
  AND NOT (u)-[:ACTION {type: "comment_generated"}]->(post)
RETURN p.name, count(post) AS post_ignorati
ORDER BY post_ignorati DESC
```

### 🌎 C. Industry Cluster Analysis
Verifica se la tua attività è allineata alla tua rete reale.
*   *Se scansioniamo le aziende:*
```cypher
MATCH (u:User)-[:CONNECTED_TO]->(p:Person)-[:WORKS_AT]->(c:Company)
RETURN c.industry, count(p) AS volume
ORDER BY volume DESC
```

---

## 🛠️ 3. Evoluzione Tecnica

1.  **Enrichment Worker**: Un servizio in Go che prende gli slug raccolti e usa API esterne (o scraping differito) per riempire i buchi (JobTitle, Industry, Company).
2.  **Alert System**: Notifica via dashboard quando un "Target" ad alta priorità pubblica un post, calcolando istantaneamente qual è il migliore "Alleato" da usare come gancio nel commento.
