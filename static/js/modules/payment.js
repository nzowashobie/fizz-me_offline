// ============================================================
// payment.js — Bridge to checkout.js
// ============================================================

(function () {
  'use strict';

  window.Asterix = window.Asterix || {};

  window.Asterix.payment = {
    open: function (dealId, amount, buyer, seller, cb) {
      if (window.Asterix.checkout && typeof window.Asterix.checkout.openPaymentForDeal === 'function') {
        window.Asterix.checkout.openPaymentForDeal(dealId, amount, buyer, seller, cb);
      } else {
        // Wait up to 2 seconds for checkout.js to load
        var attempts = 0;
        var interval = setInterval(function() {
          attempts++;
          if (window.Asterix.checkout && typeof window.Asterix.checkout.openPaymentForDeal === 'function') {
            clearInterval(interval);
            window.Asterix.checkout.openPaymentForDeal(dealId, amount, buyer, seller, cb);
          } else if (attempts > 20) {
            clearInterval(interval);
            alert('Checkout module not loaded. Please refresh the page.');
          }
        }, 100);
      }
    },
    close: function () {
      if (window.Asterix.checkout) window.Asterix.checkout.close();
    }
  };

  console.log('[Fizzme] payment.js bridged to checkout.js');
})();