'use strict';
///////////////////////////////////////////////////////////////////////////////////////
// Node packages
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const msal = require('@azure/msal-node');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const bunyan = require('bunyan');
const log = bunyan.createLogger({
    name: 'VC Issuer Web Application'
});
var fetch = require( 'node-fetch' );

///////////////////////////////////////////////////////////////////////////////////////
// MSAL configuration for obtaining access_token to execute Entra Verified ID APIs
const msalConfig = {
  auth: {
      clientId: process.env.vcApp_client_id,
      authority: 'https://login.microsoftonline.com/' + process.env.vcApp_azTenantId,
      clientSecret: process.env.vcApp_client_secret,
  }
};
const cca = new msal.ConfidentialClientApplication(msalConfig);
const msalClientCredentialRequest = {
  scopes: [process.env.vcApp_scope],
  skipCache: false
};


///////////////////////////////////////////////////////////////////////////////////////
// Main Express server function
const app = express()
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use(methodOverride());
app.use(cookieParser());
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));
app.use('/media', express.static('media'));
app.use('/lib', express.static('lib'));
const sessionStore = new session.MemoryStore();
app.use(session({
  secret: process.env.cookie_secret_key,
  resave: false,
  saveUninitialized: true,
  store: sessionStore
}))

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Serve index.html as the home page
app.get('/', function (req, res) {
  res.render('index');
})

///////////////////////////////////////////////////////////////////////////////////////
// Verifier
app.get('/verifier', function(req, res) {
  res.render('verifier');
})

// Presentation request
app.get('/api/verifier/presentation-request', async (req, res) => {

  var id = req.session.id;
  sessionStore.get( id, (error, session) => {
    var sessionData = {
      "status" : 0,
      "message": "Waiting for QR code to be scanned"
    };
    if ( session ) {
      session.sessionData = sessionData;
      sessionStore.set( id, session);  
    }
  });

  // get the Access Token to invoke issuance request API
  var accessToken = "";
  try {
    const result = await cca.acquireTokenByClientCredential(msalClientCredentialRequest);
    if ( result ) {
      accessToken = result.accessToken;
    }
  } catch {
    console.log( "failed to get access token" );
    res.status(401).json({
        'error': 'Could not acquire credentials to access your Azure Key Vault'
        });  
      return; 
  }

  // Load presentation template
  var requestConfigFile = process.env.presentation_requestTemplate;
  var presentationConfig = require( requestConfigFile );
  // authority
  presentationConfig.authority = process.env.verifier_authority;
  // registration
  presentationConfig.registration.clientName = process.env.presentation_registration_clientName;
  // callback
  presentationConfig.callback.url = process.env.baseURL + '/api/verifier/presentation-request-callback';
  presentationConfig.callback.state = id;
  if ( presentationConfig.callback.headers ) {
    presentationConfig.callback.headers['api-key'] = process.env.presentation_request_callbackAPIKey;
  }
  // requestedCredentials
  presentationConfig.requestedCredentials[0].type = process.env.presentation_request_type;
  presentationConfig.requestedCredentials[0].purpose = process.env.presentation_request_purpose;
  presentationConfig.requestedCredentials[0].acceptedIssuers[0] = process.env.presentation_request_acceptedIssuers;

  console.log( 'Invoke VC Presentation Request API' );
  var payload = JSON.stringify(presentationConfig);
  console.log( payload );
  const fetchOptions = {
    method: 'POST',
    body: payload,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length.toString(),
      'Authorization': `Bearer ${accessToken}`
    }
  };

  var client_api_request_endpoint = 'https://verifiedid.did.msidentity.com/v1.0/verifiableCredentials/createPresentationRequest';
  const response = await fetch(client_api_request_endpoint, fetchOptions);
  var resp = await response.json()

  resp.id = id;
  console.log( 'VC Client API Response' );
  console.log( resp );  
  res.status(200).json(resp);

})

// Presentation request callback
app.post('/api/verifier/presentation-request-callback', async (req, res) => {
  // console.log(req.body);
  if ( req.body.requestStatus == "request_retrieved" ) {
    console.log("callback: request_retrieved");
    sessionStore.get( req.body.state, (error, session) => {
      var cacheData = {
          "status": req.body.requestStatus,
          "message": "QR Code is scanned. Waiting for validation..."
      };
      session.sessionData = cacheData;
      sessionStore.set( req.body.state, session, (error) => {
        console.log("put status into the session : " + req.body.state);
        res.send();
      });
    })      
  }
  if ( req.body.requestStatus == "presentation_verified" ) {
    console.log("callback: presentation_verified");
    sessionStore.get(req.body.state, (error, session) => {
      var cacheData = {
          "status": req.body.requestStatus,
          "message": "Presentation received",
          "payload": req.body.verifiedCredentialsData,
          "subject": req.body.subject,
          "email": req.body.verifiedCredentialsData[0].claims.email,
          "name": req.body.verifiedCredentialsData[0].claims.name,
          "presentationResponse": req.body
      };
      session.sessionData = cacheData;
      sessionStore.set( req.body.state, session, (error) => {
        console.log("put status into the session : " + req.body.state);
        res.send();
      });
    })      
  }
  res.send()
});

app.get('/api/verifier/presentation-response', async (req, res) => {
  var id = req.query.id;
  console.log("try to get session data : " + id);
  sessionStore.get( id, (error, session) => {
    if (session && session.sessionData) {
      console.log(`status: ${session.sessionData.status}, message: ${session.sessionData.message}`);
      if ( session.sessionData.status == "presentation_verified" ) {
        delete session.sessionData.presentationResponse; // browser don't need this
      }
      res.status(200).json(session.sessionData);   
      }
  })
})


// start server
app.listen(port, () => console.log(`VC Verifier Web App is listening on port ${port}!`))
