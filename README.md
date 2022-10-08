# entra-verifier

## About

A sample implementation of verifier web application for Microsoft Entra Verified ID.  
Working demo is running [here](https://diddc-verify.azurewebsites.net/)

## Setup

* Basically following steps on Microsoft's official documents.
[here](https://docs.microsoft.com/en-us/azure/active-directory/verifiable-credentials/)

### 0. Prerequirements
* Valid Microsoft Azure Subscription and working Entra Verified ID environment.
    * Setup Entra Verified ID tenant and define Verifiable Credential issuance settings. Following information will be required during setting this verifier web.
        * Azure AD tenant ID
        * client_id
        * client_secret
        * Verifier DID

### 1. Clone Repository
```
git clone https://github.com/did-developer-community/entra-verifier.git
```

### 2. Install required modules
```
npm Install
```

### 3. Setup environments

rename .env.sample to .env and fill out required parameters regarding your environments.

```
# Basic configuration
baseURL='https://d6fb-2.....7-906c.ngrok.io'
cookie_secret_key='cookie_secret_key'
# Entra Verified Id API client application configuration
vcApp_azTenantId='b9a.....6486a'
vcApp_client_id='21b3.....619423a5'
vcApp_client_secret='FqG8.....OdrZ'
vcApp_scope='3db474b9-6a0c-4840-96ac-1fceb342124f/.default' <= do not change this value
# VC Verifier configuration
presentation_requestTemplate='./config/presentation_request_template.json'
verifier_authority='did:web:vc.diddc.co'
presentation_request_acceptedIssuers='did:web:vc.diddc.co'
presentation_registration_clientName='DID Developer Community Entra Verifier'
presentation_request_purpose='to verify your membership'
presentation_request_callbackAPIKey='aaaa'
presentation_request_type='DIDCMemberCredential'
```

note) If you run ths issuer on your local environment, please use ngrok url as baseURL in the .env file.

