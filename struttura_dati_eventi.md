# Specifiche del Modello Dati Esteso per l'Event Tracking

Questo documento definisce la struttura aggiornata del payload JSON inviato dal plugin `linkedin-suggestor` all'**Event Service** e descrive come questi dati vengono mappati nel database a grafi Neo4j. L'obiettivo è tracciare sia le interazioni attive (commenti generati, salvataggi) sia quelle passive (post visualizzati ma ignorati o scartati dai filtri), evitando problemi di omonimia grazie all'uso dello slug univoco dei profili LinkedIn.

## 1. Payload dell'Evento (JSON)

Il plugin invierà una richiesta HTTP POST all'endpoint `/events` dell'Event Service con il seguente payload:

```json
{
  "post_urn": "urn:li:activity:7123456789012345678",
  "url": "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678",
  
  "action": "post_ignored", 
  
  "author_name": "Mario Rossi",
  "author_slug": "mario-rossi-1a2b3c",
  "author_degree": "2nd",
  
  "post_text": "Oggi parliamo di intelligenza artificiale applicata ai processi aziendali...",
  
  "interaction_type": "liked", 
  "interactor_name": "Luigi Bianchi", 
  "interactor_slug": "luigi-bianchi-9z8y7x",
  
  "timestamp": "2026-02-24T21:32:00Z"
}
```

## 2. Dettaglio dei Campi

### Identificativi e Testo
- **`post_urn`**: L'identificativo univoco del post di LinkedIn (es. estratto dall'attributo `data-urn` o dall'URL). Fondamentale per il merging su Neo4j.
- **`url`**: L'indirizzo web per raggiungere direttamente il post.
- **`post_text`**: Un estratto (es. i primi 500 caratteri) del testo del post, utile per analisi semantica o ricerca testuale nel DB.

### Azione dell'Utente (Il Plugin)
- **`action`**: Definisce cosa ha fatto l'utente (o il plugin per conto suo) rispetto a quel post nel feed. Valori previsti:
  - `"post_ignored"`: Il post è passato nel feed ma è stato saltato o scartato (es. a causa del filtro sul grado "1st/2nd" o perché l'utente ha esplicitamente cliccato per ignorarlo).
  - `"comment_generated"`: L'utente ha utilizzato con successo il Co-pilot per generare e inviare un commento.
  - `"post_saved"`: L'utente ha salvato il post per leggerlo o interagirvi in un secondo momento.
  - `"post_viewed"`: L'overlay del Co-pilot è stato proposto, ma l'utente si è limitato a visualizzarlo senza intraprendere (ancora) azioni.

### Autore del Post
- **`author_name`**: Nome visualizzato dell'autore.
- **`author_slug`**: Handle univoco estratto dall'URL del profilo (`/in/slug/`). **Critico per evitare conflitti omonimi.**
- **`author_degree`**: Grado di connessione (`1st`, `2nd`, `3rd`, ecc.).

### Amplificatore / Interactor (Come il post è arrivato nel feed)
- **`interaction_type`**: La ragione organica o di rete per cui il post appare nel feed.
  - `"original"`: Il post appare perché l'utente segue direttamente l'autore o è un contenuto promosso in prima istanza.
  - `"liked"`, `"commented"`, `"reposted"`, `"suggested"`: Il post compare perché una connessione dell'utente ci ha interagito (es. "Luigi Bianchi consiglia questo").
- **`interactor_name`**: Nome della persona che ha generato l'interazione. Opzionale se `interaction_type` è `"original"`.
- **`interactor_slug`**: Handle univoco dell'interactor. Opzionale se `interaction_type` è `"original"`.
- **`timestamp`**: Data e ora dell'evento registrato dal client.

---

## 3. Mappatura sul Grafo Neo4j (Cypher)

L'Event Service tradurrà il payload nelle seguenti operazioni transazionali (`MERGE`) per garantire la consistenza del grafo:

1. **Creazione dell'Autore e del Post**:
   Garantisce l'esistenza del nodo Person dell'autore, usando lo slug. Crea/aggiorna il post e stabilisce chi lo ha scritto.
   ```cypher
   MERGE (a:Person {slug: $author_slug}) 
     ON CREATE SET a.name = $author_name, a.degree = $author_degree
     ON MATCH SET a.name = $author_name, a.degree = coalesce($author_degree, a.degree)
   
   MERGE (p:Post {urn: $post_urn}) 
     ON CREATE SET p.text = $post_text, p.url = $url
     
   MERGE (p)-[:AUTHORED_BY]->(a)
   ```

2. **Tracciamento dell'Azione dell'Utente**:
   Registra nel grafo l'interazione specifica dell'utente loggato (tu/il plugin) con quel post.
   ```cypher
   MERGE (u:User {id: $userId})
   CREATE (u)-[:ACTION {
     type: $action, 
     timestamp: $timestamp
   }]->(p)
   ```
   *Nota: Si usa `CREATE` per le azioni in modo da registrarne la cronistoria (se visualizzi un post ignorato più volte nel feed, avrai archi di interazione separati storicamente).*

3. **Creazione del Nodo Amplificatore (se presente)**:
   Se il post ti è arrivato in virtù delle interazioni di un tuo contatto, tracciamo questo legame indiretto.
   ```cypher
   // Eseguito solo se interactor_slug è valorizzato
   MERGE (i:Person {slug: $interactor_slug}) 
     ON CREATE SET i.name = $interactor_name
     ON MATCH SET i.name = $interactor_name
     
   MERGE (i)-[:AMPLIFIED {type: $interaction_type}]->(p)
   ```

## 4. Query Analitiche Abilitate

Questo schema abilita interrogazioni avanzate del feed, quali ad esempio:

- **Efficacia dei contatti (Shadow Influence)**:
  *Chi sono i miei contatti di 1° grado che mi fanno comparire più post di 2°/3° grado che finisco per ignorare sistematicamente?*

- **Conversion Rate per Autore**:
  *Di tutti i post visualizzati ("post_viewed") di uno specifico "slug" autore, quanti hanno generato un "comment_generated"?*

- **Pattern di Propagazione**:
  *Quali post vengono "liked" più frequentemente dalla mia rete portandomi a interagire anch'io con essi?*
