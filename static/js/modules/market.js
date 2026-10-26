// ============================================================
// market.js — Market Listing Panel (with edit support + multi-photo)
// ============================================================

(function () {
  'use strict';

  function getCsrf() {
    var cookie = document.cookie
      .split('; ')
      .find(function (r) { return r.startsWith('csrftoken='); });
    return cookie
      ? decodeURIComponent(cookie.split('=')[1])
      : (window.ASTERIX && window.ASTERIX.CSRF) || '';
  }

  var MAX_MEDIA = 10;

  // ── DOM refs ─────────────────────────────────────────────────────
  var dom = {
    overlay:        document.getElementById('market-panel-overlay'),
    panel:          document.getElementById('market-panel'),
    closeBtn:       document.getElementById('close-market-panel'),

    steps:          document.querySelectorAll('.mp-step'),

    page1:          document.getElementById('mp-page-1'),
    dropZone:       document.getElementById('mp-drop-zone'),
    dropPlaceholder:document.getElementById('mp-drop-placeholder'),
    fileInput:      document.getElementById('mp-file-input'),
    previewImg:     document.getElementById('mp-preview-img'),
    previewVid:     document.getElementById('mp-preview-vid'),
    multiGrid:      document.getElementById('mp-multi-grid'),
    countBadge:     document.getElementById('mp-media-count-badge'),
    removeMediaBtn: document.getElementById('mp-remove-media'),
    catChips:       document.querySelectorAll('.mp-chip'),
    next1:          document.getElementById('mp-next-1'),

    page2:          document.getElementById('mp-page-2'),
    captionInput:   document.getElementById('mp-caption'),
    captionCount:   document.getElementById('mp-caption-count'),
    priceInput:     document.getElementById('mp-price'),
    quantityInput:  document.getElementById('mp-quantity'),
    availSel:       document.getElementById('mp-availability'),
    negotiableChk:  document.getElementById('mp-negotiable'),
    customTagInput: document.getElementById('mp-custom-tag'),
    collectionInput:document.getElementById('mp-collection'),
    marketLinkInput:document.getElementById('mp-market-link'),
    back2:          document.getElementById('mp-back-2'),
    next2:          document.getElementById('mp-next-2'),

    page3:          document.getElementById('mp-page-3'),
    reviewImg:      document.getElementById('mp-review-img'),
    reviewVid:      document.getElementById('mp-review-vid'),
    reviewMultiGrid:document.getElementById('mp-review-multi-grid'),
    reviewNoMedia:  document.getElementById('mp-review-no-media'),
    reviewCatBadge: document.getElementById('mp-review-cat-badge'),
    reviewAvailBadge:document.getElementById('mp-review-avail-badge'),
    reviewPrice:    document.getElementById('mp-review-price'),
    reviewNeg:      document.getElementById('mp-review-neg'),
    reviewCaption:  document.getElementById('mp-review-caption'),
    reviewTag:      document.getElementById('mp-review-tag'),
    reviewTagText:  document.getElementById('mp-review-tag-text'),
    reviewCollection:document.getElementById('mp-review-collection'),
    reviewCollectionText:document.getElementById('mp-review-collection-text'),
    postMsg:        document.getElementById('mp-post-msg'),
    back3:          document.getElementById('mp-back-3'),
    postBtn:        document.getElementById('mp-post-btn'),
  };

  var state = {
    currentStep: 1,
    selectedFiles: [],       // ordered array of File objects (multi-photo)
    selectedFile: null,      // kept in sync = selectedFiles[0], for backward compat
    selectedFileType: null,  // 'image' | 'video' of selectedFiles[0]
    selectedCategory: 'clothing',
    editStatusId: null,
    isEditMode: false,
  };

  var CAT_LABELS = {
    clothing:  '👗 Clothing',
    shoes:     '👟 Shoes',
    cosmetics: '💄 Cosmetics',
    bags:      '👜 Bags',
    household: '🏠 Household',
    other:     '📦 Other',
  };

  var AVAIL_LABELS = {
    available: '✅ Available',
    reserved:  '🟡 Reserved',
    sold:      '❌ Sold',
  };

  var AVAIL_CSS = {
    available: 'avail-available',
    reserved:  'avail-reserved',
    sold:      'avail-sold',
  };

  // ── Open / close ─────────────────────────────────────────────────
  function open() {
    resetPanel();
    dom.overlay.classList.add('open');
    dom.panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    dom.overlay.classList.remove('open');
    dom.panel.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── Reset panel ──────────────────────────────────────────────────
  function resetPanel() {
    state.currentStep = 1;
    state.selectedFiles = [];
    state.selectedFile = null;
    state.selectedFileType = null;
    state.selectedCategory = 'clothing';
    state.editStatusId = null;
    state.isEditMode = false;
    dom.postBtn.onclick = postListing;
    dom.postBtn.textContent = 'Post to Market';
    gotoStep(1);
    clearMediaPreview();
    dom.catChips.forEach(function (c) {
      c.classList.toggle('active', c.dataset.cat === 'clothing');
    });
    dom.captionInput.value = '';
    dom.captionCount.textContent = '0';
    dom.priceInput.value = '';
    if (dom.quantityInput) dom.quantityInput.value = '1';
    dom.availSel.value = 'available';
    dom.negotiableChk.checked = false;
    dom.customTagInput.value = '';
    dom.collectionInput.value = '';
    dom.marketLinkInput.value = '';
    setPostMsg('', '');
  }

  // ── Step navigation ─────────────────────────────────────────────
  function gotoStep(step) {
    state.currentStep = step;
    [dom.page1, dom.page2, dom.page3].forEach(function (page, i) {
      page.style.display = (i + 1 === step) ? '' : 'none';
    });
    dom.steps.forEach(function (el) {
      var s = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'done');
      if (s === step) el.classList.add('active');
      if (s < step)  el.classList.add('done');
    });
    dom.panel.scrollTop = 0;
    if (step === 3) populateReview();
  }

  function validateStep1() {
    if (!state.selectedFiles.length && !state.isEditMode) {
      flashDropZone();
      return false;
    }
    return true;
  }

  function flashDropZone() {
    dom.dropZone.style.borderColor = '#f15c6d';
    dom.dropZone.style.background = 'rgba(241,92,109,.05)';
    setTimeout(function () {
      dom.dropZone.style.borderColor = '';
      dom.dropZone.style.background = '';
    }, 1200);
  }

  function validateStep2() {
    var caption = dom.captionInput.value.trim();
    var price = dom.priceInput.value.trim();
    if (!caption) {
      dom.captionInput.focus();
      dom.captionInput.style.borderColor = '#f15c6d';
      setTimeout(function () { dom.captionInput.style.borderColor = ''; }, 1200);
      return false;
    }
    if (!price || parseFloat(price) < 0) {
      dom.priceInput.focus();
      dom.priceInput.style.borderColor = '#f15c6d';
      setTimeout(function () { dom.priceInput.style.borderColor = ''; }, 1200);
      return false;
    }
    return true;
  }

  // ── Media handling (multi-photo, Facebook-style grid) ─────────────
  function handleFiles(fileList) {
    if (!fileList || !fileList.length) return;

    var incoming = Array.prototype.slice.call(fileList);
    var maxBytes = 20 * 1024 * 1024;
    var valid = [];
    var rejected = 0;

    incoming.forEach(function (file) {
      var isImage = file.type.startsWith('image/');
      var isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) { rejected++; return; }
      if (file.size > maxBytes) { rejected++; return; }
      valid.push(file);
    });

    if (rejected) {
      showToast('Some files skipped', rejected + ' file(s) were too large or an unsupported type.');
    }
    if (!valid.length) return;

    var combined = state.selectedFiles.concat(valid);
    if (combined.length > MAX_MEDIA) {
      showToast('Too many files', 'Only the first ' + MAX_MEDIA + ' photos/videos will be used.');
      combined = combined.slice(0, MAX_MEDIA);
    }

    state.selectedFiles = combined;
    state.selectedFile = combined[0];
    state.selectedFileType = combined[0].type.startsWith('video/') ? 'video' : 'image';

    renderMediaPreview();
  }

  function handleFile(file) {
    if (!file) return;
    handleFiles([file]);
  }

  function renderMediaPreview() {
    var files = state.selectedFiles;
    dom.dropPlaceholder.style.display = 'none';
    dom.dropZone.classList.add('has-media');
    dom.removeMediaBtn.style.display = 'flex';

    var addMoreBtn = document.getElementById('mp-add-more');
    if (addMoreBtn) {
      addMoreBtn.style.display = (files.length > 0 && files.length < MAX_MEDIA) ? 'flex' : 'none';
    }

    if (files.length <= 1) {
      dom.multiGrid.style.display = 'none';
      dom.multiGrid.innerHTML = '';
      dom.countBadge.style.display = 'none';

      var file = files[0];
      var url = URL.createObjectURL(file);
      var isImage = file.type.startsWith('image/');
      if (isImage) {
        dom.previewImg.src = url;
        dom.previewImg.style.display = 'block';
        dom.previewVid.style.display = 'none';
      } else {
        dom.previewVid.src = url;
        dom.previewVid.style.display = 'block';
        dom.previewImg.style.display = 'none';
      }
      return;
    }

    dom.previewImg.style.display = 'none';
    dom.previewVid.style.display = 'none';
    dom.multiGrid.style.display = 'grid';
    buildGridInto(dom.multiGrid, files);

    dom.countBadge.style.display = 'flex';
    dom.countBadge.innerHTML = '<i class="fas fa-images"></i> ' + files.length;
  }

  function buildGridInto(gridEl, files) {
    gridEl.innerHTML = '';
    var count = files.length;
    var countAttr = count >= 4 ? (count > 4 ? 'more' : '4') : String(count);
    gridEl.setAttribute('data-count', countAttr);

    var visible = files.slice(0, 4);
    visible.forEach(function (f, i) {
      var cell = document.createElement('div');
      cell.className = 'mp-grid-cell';
      var isVideo = f.type.startsWith('video/');
      if (isVideo) {
        cell.style.background = '#000';
        cell.innerHTML = '<i class="fas fa-play-circle" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;"></i>';
      } else {
        var url = URL.createObjectURL(f);
        // Added onerror fallback for broken images
        cell.innerHTML = '<img src="' + url + '" onerror="this.src=\'data:image/svg+xml;utf8,<svg xmlns=\\\'http://www.w3.org/2000/svg\\\' width=\\\'100\\\' height=\\\'100\\\'><text x=\\\'50%\\\' y=\\\'50%\\\' dominant-baseline=\\\'middle\\\' text-anchor=\\\'middle\\\' font-size=\\\'40\\\'>🖼️</text></svg>\'; this.style.objectFit=\'contain\';" style="width:100%;height:100%;object-fit:contain;background:#000;">';
      }
      if (i === 3 && count > 4) {
        var more = document.createElement('span');
        more.className = 'mp-grid-more';
        more.textContent = '+' + (count - 4);
        cell.appendChild(more);
      }
      gridEl.appendChild(cell);
    });
  }

  function removeFileAt(idx) {
    state.selectedFiles.splice(idx, 1);
    if (!state.selectedFiles.length) {
      clearMediaPreview();
      return;
    }
    state.selectedFile = state.selectedFiles[0];
    state.selectedFileType = state.selectedFiles[0].type.startsWith('video/') ? 'video' : 'image';
    renderMediaPreview();
  }

  function clearMediaPreview() {
    state.selectedFiles = [];
    state.selectedFile = null;
    state.selectedFileType = null;
    dom.previewImg.style.display = 'none';
    dom.previewImg.src = '';
    dom.previewVid.style.display = 'none';
    dom.previewVid.src = '';
    dom.multiGrid.style.display = 'none';
    dom.multiGrid.innerHTML = '';
    dom.countBadge.style.display = 'none';
    dom.dropPlaceholder.style.display = 'flex';
    dom.dropZone.classList.remove('has-media');
    dom.removeMediaBtn.style.display = 'none';
    dom.fileInput.value = '';
    var addMoreBtn = document.getElementById('mp-add-more');
    if (addMoreBtn) addMoreBtn.style.display = 'none';
  }

  // ── Review ──────────────────────────────────────────────────────
  function populateReview() {
    var files = state.selectedFiles;

    if (files.length > 1) {
      dom.reviewImg.style.display = 'none';
      dom.reviewVid.style.display = 'none';
      dom.reviewNoMedia.style.display = 'none';
      dom.reviewMultiGrid.style.display = 'grid';
      buildGridInto(dom.reviewMultiGrid, files);
    } else if (files.length === 1 && state.selectedFileType === 'image') {
      dom.reviewMultiGrid.style.display = 'none';
      dom.reviewImg.src = URL.createObjectURL(files[0]);
      dom.reviewImg.style.display = 'block';
      dom.reviewVid.style.display = 'none';
      dom.reviewNoMedia.style.display = 'none';
    } else if (files.length === 1 && state.selectedFileType === 'video') {
      dom.reviewMultiGrid.style.display = 'none';
      dom.reviewVid.src = URL.createObjectURL(files[0]);
      dom.reviewVid.style.display = 'block';
      dom.reviewImg.style.display = 'none';
      dom.reviewNoMedia.style.display = 'none';
    } else if (state.isEditMode) {
      dom.reviewMultiGrid.style.display = 'none';
      dom.reviewNoMedia.style.display = 'none';
    } else {
      dom.reviewMultiGrid.style.display = 'none';
      dom.reviewImg.style.display = 'none';
      dom.reviewVid.style.display = 'none';
      dom.reviewNoMedia.style.display = 'flex';
    }

    dom.reviewCatBadge.textContent = CAT_LABELS[state.selectedCategory] || '📦 Other';
    var avail = dom.availSel.value || 'available';
    dom.reviewAvailBadge.textContent = AVAIL_LABELS[avail] || '✅ Available';
    dom.reviewAvailBadge.className = 'mp-badge mp-badge-avail ' + (AVAIL_CSS[avail] || 'avail-available');
    var price = dom.priceInput.value.trim();
    dom.reviewPrice.textContent = price ? ('K ' + parseFloat(price).toLocaleString('en-ZM')) : 'K—';
    dom.reviewNeg.style.display = dom.negotiableChk.checked ? 'flex' : 'none';
    dom.reviewCaption.textContent = dom.captionInput.value.trim() || 'No description yet.';
    var tag = dom.customTagInput.value.trim();
    if (tag) {
      dom.reviewTag.style.display = 'flex';
      dom.reviewTagText.textContent = tag;
    } else {
      dom.reviewTag.style.display = 'none';
    }
    var col = dom.collectionInput.value.trim();
    if (col) {
      dom.reviewCollection.style.display = 'flex';
      dom.reviewCollectionText.textContent = col;
    } else {
      dom.reviewCollection.style.display = 'none';
    }
  }

  // ── Post listing ─────────────────────────────────────────────────
  function postListing() {
    if (!state.selectedFiles.length) {
      showToast('No photo', 'Please go back and add at least one photo.');
      return;
    }
    var caption = dom.captionInput.value.trim();
    var price = dom.priceInput.value.trim();
    if (!caption || !price) {
      showToast('Missing info', 'Please fill in description and price.');
      return;
    }
    dom.postBtn.disabled = true;
    dom.postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…';
    setPostMsg('', '');

    var fd = new FormData();
    state.selectedFiles.forEach(function (f) {
      fd.append('media', f);
    });
    fd.append('caption', caption);
    fd.append('category', 'Market');
    fd.append('is_commercial', 'true');
    fd.append('price', price);
    if (dom.quantityInput) fd.append('quantity', dom.quantityInput.value.trim() || '1');
    fd.append('is_negotiable', dom.negotiableChk.checked ? 'true' : 'false');
    fd.append('availability', dom.availSel.value || 'available');
    fd.append('product_category', state.selectedCategory);
    fd.append('custom_tag', dom.customTagInput.value.trim());
    fd.append('collection_point', dom.collectionInput.value.trim());
    var mktLink = dom.marketLinkInput.value.trim();
    if (mktLink) fd.append('market_link', mktLink);

    fetch('/api/status/upload/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
      body: fd,
    })
      .then(function(r) {
        return r.text().then(function(text) {
          try { return JSON.parse(text); } catch(e) { throw new Error('Server returned ' + r.status + ': ' + (text.substring(0, 100) || 'No response')); }
        });
      })
      .then(function (data) {
        dom.postBtn.disabled = false;
        dom.postBtn.innerHTML = '<i class="fas fa-store"></i> Post to Market';
        if (data.status === 'success') {
          setPostMsg('✅ Listing posted! It will be visible for 24 hours.', 'ok');
          if (window.Asterix && window.Asterix.status &&
              typeof window.Asterix.status.loadMyStatuses === 'function') {
            window.Asterix.status.loadMyStatuses();
          }
          setTimeout(function () {
            close();
            showToast('✅ Posted', 'Your listing is live on the Market!');
          }, 1600);
        } else {
          setPostMsg('❌ ' + (data.error || 'Something went wrong. Please try again.'), 'err');
        }
      })
      .catch(function (err) {
        dom.postBtn.disabled = false;
        dom.postBtn.innerHTML = '<i class="fas fa-store"></i> Post to Market';
        setPostMsg('❌ ' + (err.message || 'Network error. Check your connection.'), 'err');
      });
  }

  // ── Edit existing listing ──────────────────────────────────────────
  function editStatus(statusId) {
    fetch('/api/status/mine/')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var found = null;
        for (var cat in data.my_statuses) {
          var arr = data.my_statuses[cat];
          for (var i = 0; i < arr.length; i++) {
            if (arr[i].status_id == statusId) {
              found = arr[i];
              break;
            }
          }
          if (found) break;
        }
        if (!found) {
          showToast('Error', 'Status not found.');
          return;
        }
        openForEdit(found);
      })
      .catch(function () { showToast('Error', 'Could not load status details.'); });
  }

  function openForEdit(statusData) {
    open();
    state.editStatusId = statusData.status_id;
    state.isEditMode = true;
    dom.postBtn.textContent = '🔄 Update Listing';
    dom.postBtn.onclick = updateListing;

    setTimeout(function () {
      var cat = statusData.product_category || 'other';
      document.querySelectorAll('.mp-chip').forEach(function (c) {
        c.classList.toggle('active', c.dataset.cat === cat);
      });
      state.selectedCategory = cat;
      dom.captionInput.value = statusData.caption || '';
      dom.priceInput.value = statusData.price || '';
      if (dom.quantityInput) dom.quantityInput.value = statusData.quantity || 1;
      dom.availSel.value = statusData.availability || 'available';
      dom.negotiableChk.checked = statusData.is_negotiable || false;
      dom.customTagInput.value = statusData.custom_tag || '';
      dom.collectionInput.value = statusData.collection_point || '';
      dom.marketLinkInput.value = statusData.market_link || '';
      dom.captionCount.textContent = dom.captionInput.value.length;
      gotoStep(2);
    }, 300);
  }

  function updateListing() {
    var caption = dom.captionInput.value.trim();
    var price = dom.priceInput.value.trim();
    if (!caption || !price) {
      showToast('Missing info', 'Please fill in description and price.');
      return;
    }
    dom.postBtn.disabled = true;
    dom.postBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…';
    setPostMsg('', '');

    var fd = new FormData();
    fd.append('status_id', state.editStatusId);
    fd.append('caption', caption);
    fd.append('category', 'Market');
    fd.append('is_commercial', 'true');
    fd.append('price', price);
    if (dom.quantityInput) fd.append('quantity', dom.quantityInput.value.trim() || '1');
    fd.append('is_negotiable', dom.negotiableChk.checked ? 'true' : 'false');
    fd.append('availability', dom.availSel.value || 'available');
    fd.append('product_category', state.selectedCategory);
    fd.append('custom_tag', dom.customTagInput.value.trim());
    fd.append('collection_point', dom.collectionInput.value.trim());
    var mktLink = dom.marketLinkInput.value.trim();
    if (mktLink) fd.append('market_link', mktLink);
    if (state.selectedFiles.length) {
      state.selectedFiles.forEach(function (f) {
        fd.append('media', f);
      });
    }

    fetch('/api/status/edit/' + state.editStatusId + '/', {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrf() },
      body: fd,
    })
      .then(function(r) {
        return r.text().then(function(text) {
          try { return JSON.parse(text); } catch(e) { throw new Error('Server returned ' + r.status + ': ' + (text.substring(0, 100) || 'No response')); }
        });
      })
      .then(function (data) {
        dom.postBtn.disabled = false;
        dom.postBtn.textContent = '🔄 Update Listing';
        if (data.status === 'success') {
          setPostMsg('✅ Listing updated!', 'ok');
          if (window.Asterix && window.Asterix.status &&
              typeof window.Asterix.status.loadMyStatuses === 'function') {
            window.Asterix.status.loadMyStatuses();
          }
          setTimeout(function () {
            close();
            showToast('✅ Updated', 'Your listing has been updated!');
          }, 1600);
        } else {
          setPostMsg('❌ ' + (data.error || 'Something went wrong.'), 'err');
        }
      })
      .catch(function (err) {
        dom.postBtn.disabled = false;
        dom.postBtn.textContent = '🔄 Update Listing';
        setPostMsg('❌ ' + (err.message || 'Network error. Check your connection.'), 'err');
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  function setPostMsg(text, cls) {
    if (!text) {
      dom.postMsg.style.display = 'none';
      dom.postMsg.textContent = '';
      dom.postMsg.className = 'mp-post-msg';
      return;
    }
    dom.postMsg.textContent = text;
    dom.postMsg.className = 'mp-post-msg ' + (cls || '');
    dom.postMsg.style.display = 'block';
  }

  function showToast(title, body) {
    if (typeof window.toast === 'function') {
      window.toast(title, body);
    } else {
      console.log('[Market] ' + title + ': ' + body);
    }
  }

  // ── Wire DOM events ─────────────────────────────────────────────
  dom.closeBtn.addEventListener('click', close);
  dom.overlay.addEventListener('click', function (e) {
    if (e.target === dom.overlay) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dom.panel.classList.contains('open')) close();
  });

  dom.dropZone.addEventListener('click', function (e) {
    if (e.target === dom.removeMediaBtn || dom.removeMediaBtn.contains(e.target)) return;
    var addMoreBtn = document.getElementById('mp-add-more');
    if (addMoreBtn && (e.target === addMoreBtn || addMoreBtn.contains(e.target))) return;
    dom.fileInput.click();
  });
  dom.dropZone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dom.fileInput.click(); }
  });
  dom.dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    dom.dropZone.style.borderColor = '#e6a817';
    dom.dropZone.style.background = 'rgba(230,168,23,.07)';
  });
  dom.dropZone.addEventListener('dragleave', function () {
    dom.dropZone.style.borderColor = '';
    dom.dropZone.style.background = '';
  });
  dom.dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dom.dropZone.style.borderColor = '';
    dom.dropZone.style.background = '';
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  dom.fileInput.addEventListener('change', function () {
    if (this.files && this.files.length) {
      handleFiles(this.files);
      this.value = '';
    }
  });

  dom.removeMediaBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    clearMediaPreview();
  });

  var addMoreBtn = document.getElementById('mp-add-more');
  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dom.fileInput.click();
    });
  }

  dom.catChips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      dom.catChips.forEach(function (c) { c.classList.remove('active'); });
      chip.classList.add('active');
      state.selectedCategory = chip.dataset.cat;
    });
  });

  dom.captionInput.addEventListener('input', function () {
    dom.captionCount.textContent = this.value.length;
  });

  dom.next1.addEventListener('click', function () {
    if (validateStep1()) gotoStep(2);
  });
  dom.back2.addEventListener('click', function () { gotoStep(1); });
  dom.next2.addEventListener('click', function () {
    if (validateStep2()) gotoStep(3);
  });
  dom.back3.addEventListener('click', function () { gotoStep(2); });

  // ── Expose public API ─────────────────────────────────────────────
  window.Asterix = window.Asterix || {};
  window.Asterix.market = {
    open: open,
    close: close,
    editStatus: editStatus,
    openForEdit: openForEdit,
    removeFileAt: removeFileAt,
  };
  window.openMarketPanel = open;
  window.closeMarketPanel = close;

  console.log('[Asterix] Market module loaded (multi-photo + accumulate fix)');
})();