# **IRC <-> DeltaChat** Bridge

> Disclaimer: This bot is in an early state and the code is kinda bad

## Usage

1. create a `config.json` in the `./data` directory with following content: 

data/config.json
```json
{
    "DC_Account": {
        "address": "[email]",
        "password": "[password]"
    },
    "IRC_Connection": {
        "server": "[irc server]",
        "nick": "[nickname]",
        "password": "[password]",
        "secure": true
    }
}
```
2. run `npm i` to install the dependencies. If `deltachat-node` makes any problems, follow the steps at https://github.com/deltachat/deltachat-node#troubleshooting

3. run `npm run start` to start it.



## Using the Bot

Message the Bot and it gives you its usage/help message.