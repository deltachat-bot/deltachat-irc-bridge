# **IRC <-> DeltaChat** Bridge

> Disclaimer: This bot is in an early state and the code is kinda bad

This bot can create DeltaChat groups for irc channels and bridges between group and irc channel. You can add people manualy or let them join over the bot.
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

### Commands

```
/join #channel - join #channel
/nick [newNick] - change your irc display name
/names #channel - get online list of #channel
/topic #channel - get motd/topic of #channel
/leave #channel - leave a channel (when the group is too big to leave)
```