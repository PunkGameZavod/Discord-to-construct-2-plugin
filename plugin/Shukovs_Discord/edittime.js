﻿// edittime.js - ECMAScript 5 strict mode
"use strict";

// Регистрация плагина
function GetPluginSettings() {
  return {
    "name": "Shukovs Discord",
    "id": "ShukovsDiscord",
    "version": "1.0",
    "description": "Плагин для получения сообщений от Discord бота через WebSocket, отправки сообщений, редактирования сообщений и отправки изображений.",
    "author": "Matvey Shukov",
    "help url": "",
    "category": "Web",
    "type": "object",
    "rotatable": false,
    "flags": 0 | pf_singleglobal
  };
}

// Свойства
var property_list = [];

// Actions
AddStringParam("Server URL", "URL WebSocket сервера (например, ws://localhost:3001)");
AddAction(0, af_none, "Set Server URL", "Setup", "Set server URL to {0}", "Установить URL WebSocket сервера.", "SetServerURL");

AddStringParam("HTTP URL", "URL HTTP сервера (например, http://localhost:3000)");
AddAction(1, af_none, "Set HTTP URL", "Setup", "Set HTTP URL to {0}", "Установить URL HTTP сервера.", "SetHTTPURL");

AddStringParam("Guild ID", "ID Discord сервера для получения каналов и отправки сообщений");
AddAction(2, af_none, "Set Guild ID", "Setup", "Set Discord Guild ID to {0}", "Установить ID Discord сервера.", "SetGuildID");

AddAction(3, af_none, "Connect to Server", "Setup", "Connect to server", "Подключиться к WebSocket серверу.", "ConnectToServer");

AddAction(4, af_none, "Load Channels", "Channels", "Load text channels", "Загрузить список текстовых каналов.", "LoadChannels");

AddStringParam("Channel ID", "ID текстового канала в Discord");
AddStringParam("Message", "Текст сообщения");
AddAction(5, af_none, "Send Message", "Messages", "Send message {1} to channel {0}", "Отправить сообщение в Discord канал.", "SendMessage");

AddStringParam("Channel ID", "ID текстового канала в Discord");
AddStringParam("Message ID", "ID сообщения для редактирования");
AddStringParam("New Content", "Новый текст сообщения");
AddAction(6, af_none, "Edit Message", "Messages", "Edit message {1} in channel {0} to {2}", "Редактировать сообщение в Discord канале.", "EditMessage");

AddStringParam("Channel ID", "ID текстового канала в Discord");
AddStringParam("Base64 Image", "Изображение в формате base64");
AddAction(7, af_none, "Send Image", "Messages", "Send image to channel {0}", "Отправить изображение в Discord канал.", "SendImage");

// Conditions
AddCondition(0, cf_trigger, "On Message", "Messages", "On message received", "Сработало при получении сообщения из Discord.", "OnMessage");
AddCondition(1, cf_trigger, "On Connect", "WebSocket", "On WebSocket connect", "Сработало при подключении к WebSocket.", "OnConnect");
AddCondition(2, cf_trigger, "On Error", "WebSocket", "On WebSocket error", "Сработало при ошибке WebSocket.", "OnError");
AddCondition(3, cf_trigger, "On Send Message Success", "Messages", "On send message success", "Сработало при успешной отправке сообщения.", "OnSendMessageSuccess");
AddCondition(4, cf_trigger, "On Send Message Error", "Messages", "On send message error", "Сработало при ошибке отправки сообщения.", "OnSendMessageError");
AddCondition(5, cf_trigger, "On Channels Loaded", "Channels", "On channels loaded", "Сработало при успешной загрузке списка каналов.", "OnChannelsLoaded");
AddCondition(6, cf_trigger, "On Channels Error", "Channels", "On channels error", "Сработало при ошибке загрузки списка каналов.", "OnChannelsError");
AddCondition(7, cf_trigger, "On Edit Message Success", "Messages", "On edit message success", "Сработало при успешном редактировании сообщения.", "OnEditMessageSuccess");
AddCondition(8, cf_trigger, "On Edit Message Error", "Messages", "On edit message error", "Сработало при ошибке редактирования сообщения.", "OnEditMessageError");
AddCondition(9, cf_trigger, "On Send Image Success", "Messages", "On send image success", "Сработало при успешной отправке изображения.", "OnSendImageSuccess");
AddCondition(10, cf_trigger, "On Send Image Error", "Messages", "On send image error", "Сработало при ошибке отправки изображения.", "OnSendImageError");

// Expressions
AddExpression(0, ef_return_string, "Last Message", "Messages", "LastMessage", "Последнее сообщение (JSON: {userId, username, message, channelId, messageId}).");
AddExpression(1, ef_return_string, "Last Error", "Response", "LastError", "Последняя ошибка.");
AddExpression(2, ef_return_string, "Last Response", "Response", "LastResponse", "Последний ответ от сервера (JSON-строка).");
AddExpression(3, ef_return_string, "Text Channel List", "Channels", "TextChannelList", "Список текстовых каналов (JSON: [{id, name}]).");
AddExpression(4, ef_return_string, "Last Message ID", "Messages", "LastMessageID", "ID последнего отправленного сообщения.");

// SDK функции
function CreateIDEObjectType() { return new IDEObjectType(); }
function IDEObjectType() {}
IDEObjectType.prototype.CreateInstance = function(instance) { return new IDEInstance(instance); };
function IDEInstance(instance, type) {
  this.instance = instance;
  this.type = type;
  this.properties = {};
}
IDEInstance.prototype.OnCreate = function() {};
IDEInstance.prototype.OnPropertyChanged = function(id, value) {};
IDEInstance.prototype.OnInserted = function() {};
IDEInstance.prototype.OnRemoved = function() {};