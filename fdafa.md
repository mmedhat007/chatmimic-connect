look i feel like you're hallucintaing and don't know what you're fixing without making any edits can you explain in a very detailed manner the google sheets integration in my i don't want the files structures or wtv just the feature


you missed a crucial thing which is firebase 

we use firebase to store the sheets config as mentioned in teh @database_structure.md file here

also under the columns for each column there's these fields:
aiPrompt
"Extract any names mentioned in the message"
(string)


description
"The name of the person sending the message"
(string)


id
"name"
(string)


isAutoPopulated
false
(boolean)


name
"Customer Name"
(string)


type
"name"


so include this in your feature description


okay now that u have the general details of the feature i want you to explain to be in very deep details the technical details the api,endpoints,the calls,the backend 
based on just your opinion i want you to explain the technicals of how this should be implemented in the boundries of our project idea