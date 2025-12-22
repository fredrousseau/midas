# Protection OAuth Dynamic Client Registration avec AK/SK

## 📋 Vue d'ensemble

Le système de **Dynamic Client Registration** OAuth de Midas peut être protégé par un mécanisme d'authentification **Access Key / Secret Key (AK/SK)** utilisant des signatures HMAC-SHA256.

Cette protection est **activable/désactivable** via la variable d'environnement `SECURED_SERVER`.

## 🔐 Architecture de Sécurité

### Mécanisme d'authentification

Lorsque `SECURED_SERVER=true`, toute tentative d'enregistrement d'un nouveau client OAuth doit fournir :

1. **Access Key (AK)** : Identifiant public
2. **Secret Key (SK)** : Clé secrète partagée (ne doit JAMAIS être transmise)
3. **Signature HMAC-SHA256** : Preuve cryptographique de possession de la SK
4. **Timestamp** : Protection contre les attaques par rejeu (replay attacks)

### Fonctionnalités de sécurité

- ✅ **HMAC-SHA256** : Signature cryptographique forte
- ✅ **Timing-safe comparison** : Protection contre les timing attacks
- ✅ **Timestamp validation** : Requêtes expirées après 5 minutes
- ✅ **Replay attack prevention** : Grâce au timestamp
- ✅ **Activable/Désactivable** : Contrôlé par `SECURED_SERVER`

## 🚀 Configuration

### 1. Variables d'environnement (.env)

```env
# Activer la protection AK/SK
SECURED_SERVER=true

# Clés d'authentification pour Dynamic Client Registration
# Générer avec: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
OAUTH_REGISTRATION_ACCESS_KEY=your_access_key_here
OAUTH_REGISTRATION_SECRET_KEY=your_secret_key_here
```

### 2. Générer des clés sécurisées

```bash
# Générer une Access Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Générer une Secret Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

⚠️ **IMPORTANT** :
- Changez les clés par défaut en production !
- Ne commitez JAMAIS la Secret Key dans Git
- Stockez les clés de manière sécurisée (gestionnaire de secrets, variables d'environnement chiffrées, etc.)

## 📡 Utilisation de l'API

### Mode Non-Sécurisé (`SECURED_SERVER=false`)

Quand `SECURED_SERVER=false`, aucune authentification AK/SK n'est requise :

```bash
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "My Application",
    "redirect_uris": ["http://localhost:8080/callback"]
  }'
```

### Mode Sécurisé (`SECURED_SERVER=true`)

Quand `SECURED_SERVER=true`, vous devez fournir les headers d'authentification :

#### Headers requis

| Header | Description | Format |
|--------|-------------|--------|
| `X-Access-Key` | Votre Access Key | String |
| `X-Timestamp` | Timestamp de la requête (ms) | Number (millisecondes depuis epoch) |
| `X-Signature` | Signature HMAC-SHA256 | Hex string (64 caractères) |

#### Algorithme de signature

```
message = access_key + timestamp + JSON.stringify(body)
signature = HMAC-SHA256(secret_key, message).toHex()
```

#### Exemple avec Node.js

```javascript
import { createHmac } from 'crypto';

const ACCESS_KEY = 'your_access_key_here';
const SECRET_KEY = 'your_secret_key_here';

// 1. Préparer les données
const timestamp = Date.now();
const body = {
  client_name: 'My Application',
  redirect_uris: ['http://localhost:8080/callback']
};

// 2. Créer la signature
const bodyString = JSON.stringify(body);
const message = `${ACCESS_KEY}${timestamp}${bodyString}`;
const signature = createHmac('sha256', SECRET_KEY)
  .update(message)
  .digest('hex');

// 3. Envoyer la requête
const response = await fetch('http://localhost:3000/oauth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Access-Key': ACCESS_KEY,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
  },
  body: bodyString,
});

const result = await response.json();
console.log(result);
```

#### Exemple avec cURL et script bash

```bash
#!/bin/bash

ACCESS_KEY="your_access_key_here"
SECRET_KEY="your_secret_key_here"
TIMESTAMP=$(date +%s)000  # Millisecondes

# Corps de la requête
BODY='{"client_name":"My App","redirect_uris":["http://localhost:8080/callback"]}'

# Créer la signature
MESSAGE="${ACCESS_KEY}${TIMESTAMP}${BODY}"
SIGNATURE=$(echo -n "$MESSAGE" | openssl dgst -sha256 -hmac "$SECRET_KEY" | cut -d' ' -f2)

# Envoyer la requête
curl -X POST http://localhost:3000/oauth/register \
  -H "Content-Type: application/json" \
  -H "X-Access-Key: $ACCESS_KEY" \
  -H "X-Timestamp: $TIMESTAMP" \
  -H "X-Signature: $SIGNATURE" \
  -d "$BODY"
```

#### Exemple avec Python

```python
import hmac
import hashlib
import json
import time
import requests

ACCESS_KEY = "your_access_key_here"
SECRET_KEY = "your_secret_key_here"

# 1. Préparer les données
timestamp = int(time.time() * 1000)
body = {
    "client_name": "My Application",
    "redirect_uris": ["http://localhost:8080/callback"]
}

# 2. Créer la signature
body_string = json.dumps(body, separators=(',', ':'))
message = f"{ACCESS_KEY}{timestamp}{body_string}"
signature = hmac.new(
    SECRET_KEY.encode('utf-8'),
    message.encode('utf-8'),
    hashlib.sha256
).hexdigest()

# 3. Envoyer la requête
response = requests.post(
    'http://localhost:3000/oauth/register',
    headers={
        'Content-Type': 'application/json',
        'X-Access-Key': ACCESS_KEY,
        'X-Timestamp': str(timestamp),
        'X-Signature': signature,
    },
    json=body
)

print(response.json())
```

## 🧪 Script de Test

Un script de test complet est fourni : `test-aksk-registration.js`

```bash
# Lancer le test
node test-aksk-registration.js
```

Ce script :
- Lit les clés depuis `.env`
- Crée une signature HMAC-SHA256 valide
- Enregistre un nouveau client OAuth
- Affiche les détails du client créé

## 🔄 Flux d'enregistrement sécurisé

```
1. Client génère un timestamp
   ↓
2. Client crée le corps de la requête (JSON)
   ↓
3. Client concatène : access_key + timestamp + body
   ↓
4. Client signe avec HMAC-SHA256(secret_key, message)
   ↓
5. Client envoie POST /oauth/register avec headers:
   - X-Access-Key: <access_key>
   - X-Timestamp: <timestamp>
   - X-Signature: <signature>
   ↓
6. Serveur vérifie l'Access Key
   ↓
7. Serveur vérifie que le timestamp est récent (< 5 min)
   ↓
8. Serveur recalcule la signature attendue
   ↓
9. Serveur compare avec timing-safe comparison
   ↓
10. Si valide → Enregistrement du client
    Si invalide → Erreur 401 Unauthorized
```

## ❌ Codes d'erreur

| Erreur | Description | Solution |
|--------|-------------|----------|
| `Missing required headers` | Headers AK/SK manquants | Ajouter les 3 headers requis |
| `Invalid access key` | Access Key incorrecte | Vérifier `OAUTH_REGISTRATION_ACCESS_KEY` |
| `Request timestamp expired` | Timestamp trop ancien (> 5 min) | Régénérer un nouveau timestamp |
| `Invalid signature` | Signature HMAC invalide | Vérifier l'algorithme de signature |
| `Signature verification failed` | Erreur format signature | Vérifier que la signature est en hex |

## 🛡️ Bonnes pratiques de sécurité

### En développement

✅ Utilisez des clés de développement simples dans `.env`
✅ Commitez `.env.sample` avec des valeurs d'exemple
✅ Ajoutez `.env` dans `.gitignore`

### En production

✅ **Générez des clés aléatoires cryptographiquement sécurisées**
✅ **Stockez les clés dans un gestionnaire de secrets** (AWS Secrets Manager, HashiCorp Vault, etc.)
✅ **Utilisez HTTPS** pour toutes les communications
✅ **Activez toujours `SECURED_SERVER=true`**
✅ **Rotez les clés régulièrement**
✅ **Loggez les tentatives d'authentification échouées**
✅ **Surveillez les patterns d'attaque** (brute-force, replay, etc.)

### Rotation des clés

1. Générez de nouvelles clés AK/SK
2. Mettez à jour `.env` sur le serveur
3. Redémarrez le serveur
4. Informez tous les clients de mettre à jour leurs clés
5. Invalidez les anciennes clés après une période de transition

## 🔧 Désactiver la protection AK/SK

Pour désactiver temporairement (développement uniquement) :

```env
SECURED_SERVER=false
```

⚠️ **NE JAMAIS désactiver en production !**

Quand désactivé :
- Le endpoint `/oauth/register` accepte toutes les requêtes sans authentification
- Les API et MCP restent accessibles sans Bearer token
- Le WebUI reste toujours protégé (authentification permanente)

## 📊 Surveillance et Logs

### Logs de succès

```
[info]: New client registered: My Application (3d245377-68e0-45f1-8928-c3aca3efe9d4)
```

### Logs d'échec

```
[warn]: Registration auth failed: Invalid access key
[warn]: Registration auth failed: Request timestamp expired (max 5 minutes)
[warn]: Registration auth failed: Invalid signature
```

### Recommandations monitoring

- Alertes sur tentatives répétées d'authentification échouées
- Dashboard des enregistrements clients réussis/échoués
- Analyse des patterns d'attaque
- Tracking des clés d'accès utilisées

## 🐛 Dépannage

### Problème : "Invalid signature"

**Causes possibles :**
1. Secret Key incorrecte
2. Ordre de concaténation incorrect (`access_key + timestamp + body`)
3. Format JSON du body différent (espaces, ordre des clés)
4. Encoding incorrect (doit être UTF-8)

**Solution :**
```javascript
// Assurez-vous d'utiliser exactement cet ordre
const message = `${accessKey}${timestamp}${JSON.stringify(body)}`;
const signature = createHmac('sha256', secretKey)
  .update(message)
  .digest('hex');
```

### Problème : "Request timestamp expired"

**Cause :** Le timestamp est trop ancien (> 5 minutes)

**Solution :** Générez un nouveau timestamp juste avant chaque requête
```javascript
const timestamp = Date.now(); // Millisecondes
```

### Problème : "Missing required headers"

**Cause :** Headers manquants ou mal nommés

**Solution :** Vérifiez les noms exacts (sensibles à la casse)
```javascript
headers: {
  'X-Access-Key': accessKey,      // Exact
  'X-Timestamp': timestamp,        // Exact
  'X-Signature': signature,        // Exact
}
```

## 📚 Références

- [RFC 7591 - OAuth 2.0 Dynamic Client Registration](https://tools.ietf.org/html/rfc7591)
- [HMAC - Hash-based Message Authentication Code](https://en.wikipedia.org/wiki/HMAC)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Timing Attack Prevention](https://codahale.com/a-lesson-in-timing-attacks/)

---

**Version :** 1.0.0
**Date :** 2025-12-20
**Auteur :** Système OAuth AK/SK Midas
