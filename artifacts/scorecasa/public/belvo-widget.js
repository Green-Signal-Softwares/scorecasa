
  function isBelvoLoaded(url) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length; i--;) {
          if (scripts[i].src == url) return true;
      }
      return false;
  }
  if (!isBelvoLoaded('https://cdn.belvo.io/v2.87.8/stable/belvo-widget-1-stable-main.js')) {

    (function () {
      const scriptNode = document.createElement('script');
      scriptNode.src = 'https://cdn.belvo.io/v2.87.8/stable/belvo-widget-1-stable-main.js';
      scriptNode.type = 'module';
      const head = document.head;
      head.appendChild(scriptNode);
    })();
    
    (function () {
      window.belvoSDK = {
        createWidget(accessToken, config) {
          this.accessToken = accessToken;
          this.config = config;
          return this;
        },
        build() {
          document.addEventListener('belvoReady', () => {
            window.belvoSDK.createWidget(this.accessToken, this.config).build();
          })
        }
      }
    })();
    (function () {
      const linkNode = document.createElement('link');
      linkNode.href = 'https://cdn.belvo.io/v2.87.8/stable/belvo-widget-1-stable-main.js';
      linkNode.rel = "modulepreload";
      linkNode.as = "script";
      const head = document.head;
      head.appendChild(linkNode);
    })();
    }