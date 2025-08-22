// runtime.js
(function () {
  var pluginProto = cr.plugins_.ShukovsDiscord = function(runtime) {
    this.runtime = runtime;
    this.serverURL = "";
    this.httpURL = "";
    this.guildId = "";
    this.websocket = null;
    this.reconnectInterval = 5000;
    this.lastMessage = "";
    this.lastError = "";
    this.lastResponse = "";
    this.textChannelList = "";
    this.lastMessageID = "";
  };

  var proto = pluginProto.prototype;

  proto.Type = function(plugin) {
    this.plugin = plugin;
    this.runtime = plugin.runtime;
  };

  var typeProto = proto.Type.prototype;
  typeProto.onCreate = function() {};

  proto.Instance = function(type) {
    this.type = type;
    this.runtime = type.runtime;
    this.serverURL = "";
    this.httpURL = "";
    this.guildId = "";
    this.websocket = null;
    this.reconnectInterval = 5000;
    this.lastMessage = "";
    this.lastError = "";
    this.lastResponse = "";
    this.textChannelList = "";
    this.lastMessageID = "";
  };

  var instanceProto = proto.Instance.prototype;
  instanceProto.onCreate = function() {
    // Ничего не делаем при создании, ждем
  };

  instanceProto.tick = function() {
    // Проверяем необходимость переподключения
    if (this.serverURL && (!this.websocket || this.websocket.readyState === WebSocket.CLOSED)) {
      var now = Date.now();
      if (!this.lastReconnectTime || (now - this.lastReconnectTime >= this.reconnectInterval)) {
        this.connectWebSocket();
        this.lastReconnectTime = now;
      }
    }
  };

  instanceProto.loadChannels = function() {
    var self = this;
    if (!this.guildId) {
      self.lastError = "Guild ID not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsError, self);
      return;
    }
    if (!this.httpURL) {
      self.lastError = "HTTP URL not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsError, self);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", this.httpURL + "/channels/" + this.guildId, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        self.lastResponse = xhr.responseText;
        if (xhr.status === 200) {
          try {
            var parsed = JSON.parse(xhr.responseText);
            self.textChannelList = JSON.stringify(parsed.channels);
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsLoaded, self);
          } catch (err) {
            self.lastError = "Invalid channels response format";
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsError, self);
          }
        } else {
          self.lastError = xhr.responseText || "Error " + xhr.status;
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsError, self);
        }
      }
    };
    xhr.onerror = function () {
      self.lastError = "Network error loading channels";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnChannelsError, self);
    };
    xhr.send();
  };

  instanceProto.connectWebSocket = function() {
    var self = this;
    if (!this.serverURL) {
      self.lastError = "Server URL not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnError, self);
      return;
    }
    try {
      this.websocket = new WebSocket(this.serverURL);
      this.websocket.onopen = function() {
        self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnConnect, self);
      };
      this.websocket.onmessage = function(event) {
        try {
          self.lastMessage = event.data;
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnMessage, self);
        } catch (err) {
          self.lastError = "Invalid message format";
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnError, self);
        }
      };
      this.websocket.onerror = function() {
        self.lastError = "WebSocket connection error";
        self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnError, self);
      };
      this.websocket.onclose = function() {
        self.lastError = "WebSocket connection closed";
        self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnError, self);
      };
    } catch (err) {
      self.lastError = "Failed to create WebSocket: " + err.message;
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnError, self);
    }
  };

  // Conditions
  function Cnds() {};
  Cnds.prototype.OnMessage = function () { return true; };
  Cnds.prototype.OnConnect = function () { return true; };
  Cnds.prototype.OnError = function () { return true; };
  Cnds.prototype.OnSendMessageSuccess = function () { return true; };
  Cnds.prototype.OnSendMessageError = function () { return true; };
  Cnds.prototype.OnChannelsLoaded = function () { return true; };
  Cnds.prototype.OnChannelsError = function () { return true; };
  Cnds.prototype.OnEditMessageSuccess = function () { return true; };
  Cnds.prototype.OnEditMessageError = function () { return true; };
  Cnds.prototype.OnSendImageSuccess = function () { return true; };
  Cnds.prototype.OnSendImageError = function () { return true; };
  proto.cnds = new Cnds();

  // Actions
  function Acts() {};
  Acts.prototype.SetServerURL = function (url) {
    this.serverURL = url;
  };

  Acts.prototype.SetHTTPURL = function (url) {
    this.httpURL = url;
  };

  Acts.prototype.SetGuildID = function (guildId) {
    this.guildId = guildId;
  };

  Acts.prototype.ConnectToServer = function () {
    this.connectWebSocket();
  };

  Acts.prototype.LoadChannels = function () {
    this.loadChannels();
  };

  Acts.prototype.SendMessage = function (channelId, message) {
    var self = this;
    if (!this.httpURL) {
      self.lastError = "HTTP URL not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageError, self);
      return;
    }
    if (!channelId || !message) {
      self.lastError = "Channel ID or message not provided";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageError, self);
      return;
    }
    var data = JSON.stringify({ channelId: channelId, message: message });
    var xhr = new XMLHttpRequest();
    xhr.open("POST", this.httpURL + "/send-message", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        self.lastResponse = xhr.responseText;
        if (xhr.status === 200) {
          try {
            var parsed = JSON.parse(xhr.responseText);
            self.lastMessageID = parsed.messageId || "";
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageSuccess, self);
          } catch (err) {
            self.lastError = "Invalid response format";
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageError, self);
          }
        } else {
          self.lastError = xhr.responseText || "Error " + xhr.status;
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageError, self);
        }
      }
    };
    xhr.onerror = function () {
      self.lastError = "Network error sending message";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendMessageError, self);
    };
    xhr.send(data);
  };

  Acts.prototype.EditMessage = function (channelId, messageId, newContent) {
    var self = this;
    if (!this.httpURL) {
      self.lastError = "HTTP URL not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnEditMessageError, self);
      return;
    }
    if (!channelId || !messageId || !newContent) {
      self.lastError = "Channel ID, message ID, or new content not provided";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnEditMessageError, self);
      return;
    }
    var data = JSON.stringify({ channelId: channelId, messageId: messageId, newContent: newContent });
    var xhr = new XMLHttpRequest();
    xhr.open("PATCH", this.httpURL + "/edit-message", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        self.lastResponse = xhr.responseText;
        if (xhr.status === 200) {
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnEditMessageSuccess, self);
        } else {
          self.lastError = xhr.responseText || "Error " + xhr.status;
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnEditMessageError, self);
        }
      }
    };
    xhr.onerror = function () {
      self.lastError = "Network error editing message";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnEditMessageError, self);
    };
    xhr.send(data);
  };

  Acts.prototype.SendImage = function (channelId, base64Image) {
    var self = this;
    if (!this.httpURL) {
      self.lastError = "HTTP URL not set";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageError, self);
      return;
    }
    if (!channelId || !base64Image) {
      self.lastError = "Channel ID or base64 image not provided";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageError, self);
      return;
    }
    // Удаляем Data URL и муоср тд, если он есть
    var cleanBase64 = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    var data = JSON.stringify({ channelId: channelId, base64Image: cleanBase64 });
    var xhr = new XMLHttpRequest();
    xhr.open("POST", this.httpURL + "/send-image", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        self.lastResponse = xhr.responseText;
        if (xhr.status === 200) {
          try {
            var parsed = JSON.parse(xhr.responseText);
            self.lastMessageID = parsed.messageId || "";
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageSuccess, self);
          } catch (err) {
            self.lastError = "Invalid response format";
            self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageError, self);
          }
        } else {
          self.lastError = xhr.responseText || "Error " + xhr.status;
          self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageError, self);
        }
      }
    };
    xhr.onerror = function () {
      self.lastError = "Network error sending image";
      self.runtime.trigger(cr.plugins_.ShukovsDiscord.prototype.cnds.OnSendImageError, self);
    };
    xhr.send(data);
  };

  proto.acts = new Acts();

  // Expressions
  function Exps() {};
  Exps.prototype.LastMessage = function (ret) { ret.set_string(this.lastMessage); };
  Exps.prototype.LastError = function (ret) { ret.set_string(this.lastError); };
  Exps.prototype.LastResponse = function (ret) { ret.set_string(this.lastResponse); };
  Exps.prototype.TextChannelList = function (ret) { ret.set_string(this.textChannelList); };
  Exps.prototype.LastMessageID = function (ret) { ret.set_string(this.lastMessageID); };
  proto.exps = new Exps();
}());