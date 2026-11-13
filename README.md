# 🎮 TheGameLibrary

La mia libreria digitale personale dei videogiochi giocati.

- **Profili in stile Netflix**: all'apertura scegli chi gioca. Ogni profilo ha la sua libreria e la sua lista di uscite. I profili si creano, rinominano ed eliminano dal sito ("Gestisci profili"), con 16 avatar pixel art tra cui scegliere.
- **Backlog**: nella pagina "In uscita", sotto le uscite, la lista dei giochi che vuoi giocare, con il tempo per finirli (storia, storia + extra, completista) e il totale delle ore. Il pulsante **⏱ HLTB** apre la pagina di HowLongToBeat del gioco da cui copiare i tempi; **✔ Giocato** sposta il gioco nella libreria.
- **Preferiti**: tocca la stella ☆ accanto a un gioco (in classifica o nella sua scheda) per segnarlo come preferito; il filtro **★ Preferiti** in classifica mostra solo quelli.
- **In corso**: imposta lo stato "In corso" (o premi **▶ Inizia** su un gioco del backlog) e il gioco compare in cima alla Home, con **⏱ Ore** per aggiornare le ore e **✔ Finito** per dargli il voto. I giochi in corso entrano in classifica e nelle statistiche solo quando li finisci.
- **Statistiche** (barra in basso): **Riepilogo anno** con gioco dell'anno, ore, voto medio, console e genere preferiti, distribuzione dei voti e classifica dell'anno; **Confronto** tra due profili con percentuale di affinità, numeri a confronto, giochi in comune e giochi consigliati dall'altro profilo (con **+ Backlog**).
- **Impostazioni**: sul telefono si aprono dall'ingranaggio ⚙ in alto, accanto all'avatar.
- **Home**: voto medio, ore totali, numero di giochi, grafico dei giochi giocati per anno, Top 5 e prossime uscite.
- **Classifica**: tutti i giochi, ordinati per voto (o per titolo, stato, ore, anno giocato, anno di uscita, console). Ricerca e filtro per stato. Clicca un gioco per vederne i dettagli, modificarlo o eliminarlo.
- **In uscita**: giochi futuri con la data di uscita, in ordine cronologico con conto alla rovescia. Quando un gioco è uscito, il pulsante **+ Libreria** lo sposta nella libreria.
- **Impostazioni (⚙)**: collegamento a GitHub, ricerca delle copertine mancanti, esportazione/importazione del backup.
- **Ricerca automatica dei dati**: mentre scrivi il titolo, il sito cerca il gioco e ti propone i risultati. Scegliendo quello giusto compila copertina, sviluppatore, franchise, genere e anno (per le uscite: copertina e data). I dati vengono da [Wikidata](https://www.wikidata.org) e le copertine da Wikipedia: servizi gratuiti, senza chiavi né registrazione.
- **Icona**: aggiungendo il sito alla schermata Home dell'iPhone (Safari → Condividi → *Aggiungi alla schermata Home*) compare il logo della libreria e il sito si apre a schermo intero come un'app.

Il sito è fatto solo di HTML, CSS e JavaScript, senza installazioni né build.

## Dove vengono salvati i dati

I giochi sono salvati in due file di questa repository:

- `data/games.json`: i giochi giocati
- `data/upcoming.json`: i giochi in uscita

Ogni volta che aggiungi, modifichi o elimini qualcosa dal sito viene creato un **commit** su GitHub. I dati non scadono mai e hai lo storico completo di ogni modifica (puoi sempre tornare indietro dalla cronologia dei commit).

### Con i profili
- `data/users.json`: l'elenco dei profili (nome, avatar, cartella dei dati)
- il **primo profilo** creato usa `data/games.json` e `data/upcoming.json` (i giochi inseriti prima dei profili)
- gli altri profili hanno la loro cartella: `data/users/<id>/games.json`, `upcoming.json` e `backlog.json`
- il backlog del primo profilo è in `data/backlog.json` (i file del backlog vengono creati al primo gioco aggiunto)

Eliminare un profilo lo nasconde dal sito, ma i suoi file restano nella repository: per recuperarlo basta togliere `"deleted": true` dalla sua voce in `data/users.json`.

Il token GitHub permette di modificare tutti i profili: dallo a persone di fiducia.

Gli avatar sono in `assets/avatars/` e si rigenerano con `python3 tools/make_avatars.py`.

## Configurazione (una volta sola)

### 1. Pubblica il sito con GitHub Pages
1. Su GitHub apri la repository, poi **Settings → Pages**.
2. In *Build and deployment* scegli **Source: Deploy from a branch**, branch **`main`**, cartella **`/ (root)`**, poi **Save**.
3. Dopo un minuto il sito sarà online su `https://<tuo-utente>.github.io/TheGameLibrary/`.

### 2. Crea un token per poter salvare
Il token permette al sito di scrivere i file dei dati, **solo** in questa repository.

1. Vai su GitHub → foto profilo → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Nome: `TheGameLibrary`. Scadenza: quella che preferisci (anche *No expiration*).
3. **Repository access → Only select repositories →** `TheGameLibrary`.
4. **Permissions → Repository permissions → Contents → Read and write**.
5. Genera il token e copialo (inizia con `github_pat_…`).

### 3. Inserisci il token nel sito
Apri il sito, vai su **⚙ Impostazioni**, controlla proprietario/repository/branch (`main`), incolla il token e premi **Salva e ricarica**.

Il token resta salvato **solo nel browser di quel dispositivo**: su telefono e PC va inserito una volta per ciascuno. Senza token il sito funziona in sola lettura.

> ⚠️ Non condividere mai il token con nessuno. Se pensi che sia stato esposto, eliminalo da GitHub e creane uno nuovo.

## Backup
Da **⚙ Impostazioni → Esporta backup** scarichi un file JSON con tutti i dati. Con **Importa backup** lo ripristini.

## Aggiornamenti del sito
Quando modifichi il codice, prima del commit esegui `python3 tools/bump_version.py`: aggiorna il numero di versione e il sito, aperto su qualsiasi dispositivo, si ricarica da solo con la versione nuova (al massimo qualche minuto dopo la pubblicazione).

## Provarlo in locale
```bash
python3 -m http.server 8000
```
Poi apri http://localhost:8000. Per salvare, inserisci comunque il token nelle Impostazioni: i dati vengono scritti su GitHub.
