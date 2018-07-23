/*-----------------------------------------------------------------------------
This template demonstrates how to use Waterfalls to collect input from a user using a sequence of steps.
For a complete walkthrough of creating this type of bot see the article at
https://aka.ms/abs-node-waterfall
-----------------------------------------------------------------------------*/
"use strict";
var builder = require("botbuilder");
var botbuilder_azure = require("botbuilder-azure");
var path = require('path');
var menu = require("./menu.json");

var useEmulator = (process.env.NODE_ENV == 'development');

var connector = useEmulator ? new builder.ChatConnector() : new botbuilder_azure.BotServiceConnector({
    appId: process.env['MicrosoftAppId'],
    appPassword: process.env['MicrosoftAppPassword'],
    openIdMetadata: process.env['BotOpenIdMetadata']
});

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var tableName = 'botdata';
var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

var bot = new builder.UniversalBot(connector, function (session, args) {
    session.send('You reached the default message handler. You said \'%s\'.', session.message.text);
});

bot.localePath(path.join(__dirname, './locale'));
bot.set('storage', tableStorage);

const LuisModelUrl = process.env.LUIS_URL;

// Create a recognizer that gets intents from LUIS, and add it to the bot
var recognizer = new builder.LuisRecognizer(LuisModelUrl);
bot.recognizer(recognizer);

bot.dialog('greetings', [
    (session) => session.send("Boa noite, Pizzaria Kalabalis, o que deseja?")
]).triggerAction({
    matches: 'greetings'
});

bot.dialog('create-order', [
    (session, args) => {
        const entities = args.intent.entities;
        if (entities.length > 0) {
            if (!session.conversationData.order) {
                session.conversationData.order = [];
            }

            session.conversationData.order = session.conversationData.order.concat(
                entities.map(item => item.entity)
            );

            session.send("Pedido adicionado");
        }
        else {
            session.beginDialog('menu-request');
        }
    }
]).triggerAction({
    matches: 'create-order'
});

bot.dialog('menu-request', [
    (session, args) => {
        const cards = menu.map(item => createHeroCard(session, item));

        const carousel = new builder.Message(session)
            .attachmentLayout(builder.AttachmentLayout.carousel)
            .attachments(cards);

        session.send(carousel);
    }
]).triggerAction({
    matches: 'menu-request'
});

bot.dialog('working-hours', [
    (session, args) => session.send("Trabalhamos das 11:00 às 15:00 e das 18:00 às 24:00")
]).triggerAction({
    matches: 'working-hours'
});

function createHeroCard(session, order) {
    return new builder.HeroCard(session)
        .title(order.title)
        .subtitle(order.subtitle)
        .text(order.text)
        .images([
            builder.CardImage.create(session, order.image)
        ])
        .buttons([
            builder.CardAction.postBack(session, `Adicionar ao pedido: ${order.title}`, "Adicionar")
        ]);
}

if (useEmulator) {
    var restify = require('restify');
    var server = restify.createServer();
    server.listen(3978, function () {
        console.log('test bot endpont at http://localhost:3978/api/messages');
    });
    bot.set('storage', new builder.MemoryBotStorage());
    server.post('/api/messages', connector.listen());
} else {
    module.exports = connector.listen();
}
