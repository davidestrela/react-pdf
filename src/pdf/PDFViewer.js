import { loadCDN, isMobile, $ } from './utils';
import Hammer from 'hammerjs';

const USE_ONLY_CSS_ZOOM = true;
const TEXT_LAYER_MODE = 1; // DISABLE
const MAX_IMAGE_SIZE = 1024 * 1024;
const DEFAULT_SCALE_DELTA = 1.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4.0;
const DEFAULT_SCALE_VALUE = 'auto';

const actions = {
  top: 'loqr-sdk-pdf-actions-top',
  bottom: 'loqr-sdk-pdf-actions-bottom',
  none: ''
};
const emptyFunction = () => {};

export default class PDFViewer {
  constructor({ source, opts = {} }) {
    this.source = source;

    while (source.firstChild) {
      source.removeChild(source.firstChild);
    }

    const { filename = `document_${Date.now()}.pdf` } = opts;
    this.filename = filename.endsWith('pdf') ? filename : `${filename}.pdf`;
    this.reachBottom = false;
    this.onReachBottomOnce = opts.onReachBottomOnce || emptyFunction;
    this.isMobile = isMobile();
    this.fingersDown = 0;
    this.actionClass =
      actions[String(opts.actions)] !== undefined
        ? actions[String(opts.actions)]
        : actions['top'];
  }

  async open(url, args) {
    try {
      /*	const cdn = this.sdk.config.getCdn('PDF');
			if (!window.pdfjsLib) {
				await loadCDN(`${cdn}/build/pdf.js`);
			}
			if (!window.pdfjsViewer) {
				await loadCDN(`${cdn}/web/pdf_viewer.js`);
			}
    */
      // TO VALIDATE
      /*      if (!window.pdfjsLib) {
        console.error('Missing pdfjsLib dep!')}
        return 0;
      }

      if (!window.pdfjsViewer) {
        console.error('Missing pdfjsViewer dep!')}
        return 0;
      }
*/

      await this.setup(url, args);
    } catch (error) {
      console.log('ERROR LOADING PDF', error);
      throw error;
    }
  }

  async setup(url, args = {}) {
    const { headers = false, downloadButton = true } = args;
    if (this.pdfLoadingTask) {
      await this.closeTask();
    }

    const div = document.createElement('div');

    div.innerHTML = `
				<div class="loqr-sdk-pdf-container ${this.actionClass}">
					<div class="loqr-sdk-pdf-viewer-container">
						<div id="viewer" class="pdfViewer"></div>
					</div>
                </div>
                <div class="loqr-sdk-pdf-actions ${this.actionClass}">
                    <ul>
                        <li><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-prev-page"></button></li>
                        <li><div class="loqr-sdk-pdf-page-number">1</div></li>
                        <li>/</li>
                        <li><div class="loqr-sdk-pdf-page-count"></div></li>
                        <li><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-next-page"></button></li>

                        <li class="loqr-sdk-right"><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-button-download"></button></li>
                        <li class="loqr-sdk-right"><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-zoom-button-in loqr-sdk-section"></button></li>
                        <li class="loqr-sdk-right"><input class="loqr-sdk-pdf-zoom-scale" value="100%"></li>
                        <li class="loqr-sdk-right"><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-zoom-button-out"></button></li>
                    </ul>
					<div>
				</div>
				</div>`;

    //<li class="loqr-sdk-right"><a href="${url}" target="_blank" download="${Date.now()}.pdf"><button type="button" class="loqr-sdk-pdf-button loqr-sdk-pdf-button-download"></button></a></li>

    div.classList.add('loqr-sdk-pdf-viewer');
    div.id = `loqr-sdk-pdf-viewer${Date.now()}`;
    this._id = div.id;

    if (!this.actionClass) {
      $(div.querySelector('.loqr-sdk-pdf-actions')).hide();
    }

    this.container = div.querySelector('.loqr-sdk-pdf-viewer');
    this.pdfContainer = div.querySelector('.loqr-sdk-pdf-viewer-container');
    this.buttonZoomIn = div.querySelector('.loqr-sdk-pdf-zoom-button-in');
    this.buttonZoomOut = div.querySelector('.loqr-sdk-pdf-zoom-button-out');
    this.buttonDownload = div.querySelector('.loqr-sdk-pdf-button-download');
    this.scaleInput = div.querySelector('.loqr-sdk-pdf-zoom-scale');

    this.currentPageDiv = div.querySelector('.loqr-sdk-pdf-page-number');
    this.lastPageDiv = div.querySelector('.loqr-sdk-pdf-page-count');

    this.btNextPage = div.querySelector('.loqr-sdk-pdf-next-page');
    this.btPrevPage = div.querySelector('.loqr-sdk-pdf-prev-page');

    this.source.appendChild(div);

    this.pdfLinkService = new pdfjsViewer.PDFLinkService();

    this.pdfHistory = new pdfjsViewer.PDFHistory({
      linkService: this.pdfLinkService
    });
    this.downloadManager = new pdfjsViewer.DownloadManager({});

    this.pdfViewer = new pdfjsViewer.PDFViewer({
      container: this.pdfContainer,
      linkService: this.pdfLinkService,
      downloadManager: this.downloadManager
    });

    this.pdfLinkService.setViewer(this.pdfViewer);

    document.addEventListener('pagesinit', () => {
      if (!document.body.contains(div)) return;
      try {
        // We can use pdfViewer now, e.g. let's change default scale.
        this.pdfViewer.currentScaleValue = DEFAULT_SCALE_VALUE;
        this.updateScale(this.pdfViewer.currentScale);
      } catch (err) {}
    });

    document.addEventListener('pagerendered', () => {
      if (!document.body.contains(div)) return;
      this.updateScale(this.pdfViewer.currentScale);
      this.checkReachBottom();
      setTimeout(() => {
        if (document.body.contains(div)) {
          this.checkReachBottom();
        }
      }, 100);
    });

    document.addEventListener(
      'pagechanging',
      evt => {
        if (!document.body.contains(div)) return;
        try {
          const page = evt.detail.pageNumber;
          this.currentPageDiv.innerHTML = page;

          $(this.btPrevPage).enable();
          $(this.btNextPage).enable();

          if (page <= 1) {
            $(this.btPrevPage).disable();
          }
          if (page >= this.numPages) {
            $(this.btNextPage).disable();
          }

          this.checkReachBottom();
          this.updateScale(this.pdfViewer.currentScale);
        } catch (err) {}
      },
      true
    );

    this.pdfLoadingTask = pdfjsLib.getDocument(
      this.getConstrainsts(url, headers)
    );

    const pdfDocument = await this.pdfLoadingTask.promise;
    this.pdfViewer.setDocument(pdfDocument);
    this.pdfLinkService.setDocument(pdfDocument, null);

    if (!document.body.contains(this.source)) throw new Error('no container');

    this.pdfDocument = pdfDocument;
    this.pdfHistory.initialize({
      fingerprint: pdfDocument.fingerprint
    });

    this.numPages = this.pdfDocument._pdfInfo.numPages;
    this.lastPageDiv.innerHTML = this.numPages;

    this.buttonZoomIn.addEventListener('click', this.zoomIn.bind(this));
    this.buttonZoomOut.addEventListener('click', this.zoomOut.bind(this));
    this.btNextPage.addEventListener('click', this.nextPage.bind(this));
    this.btPrevPage.addEventListener('click', this.prevPage.bind(this));
    this.buttonDownload.addEventListener('click', this.download.bind(this));
    $(this.prevPage).disable();

    this.configureGestures();

    this.pdfContainer.addEventListener('scroll', () => {
      this.checkReachBottom();
    });

    if (downloadButton === false) {
      this.buttonDownload.parentNode.parentNode.removeChild(
        this.buttonDownload.parentNode
      );
    }
  }

  async download({ sourceEventType = 'download' } = {}) {
    if (this.downloading) return;

    this.downloading = true;
    const getUrl = window.location;
    const url =
      getUrl.protocol +
      '//' +
      getUrl.host +
      '/' +
      getUrl.pathname.split('/')[1];

    try {
      const data = await this.pdfDocument.getData();
      const blob = new Blob([data], { type: 'application/pdf' });
      this.downloadManager.download(blob, url, this.filename, sourceEventType);
      this.downloading = false;
    } catch (err) {
      this.downloadManager.downloadUrl(url, this.filename);
      this.downloading = false;
    }
  }

  get page() {
    return this.pdfViewer.currentPageNumber;
  }

  set page(val) {
    this.pdfViewer.currentPageNumber = val;
  }

  nextPage() {
    if (this.page < this.numPages) {
      this.page++;
    }
  }

  prevPage() {
    if (this.page > 1) {
      this.page--;
    }
  }

  async closeTask() {
    if (!this.pdfLoadingTask) {
      return;
    }

    const promise = this.pdfLoadingTask.destroy();
    this.pdfLoadingTask = null;

    if (this.pdfDocument) {
      this.pdfDocument = null;

      this.pdfViewer.setDocument(null);
      this.pdfLinkService.setDocument(null, null);
    }

    await promise;
  }

  zoomIn() {
    let newScale = this.pdfViewer.currentScale;

    newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
    newScale = Math.ceil(newScale * 10) / 10;
    newScale = Math.min(MAX_SCALE, newScale);

    this.pdfViewer.currentScaleValue = newScale;
    this.updateScale(newScale);

    this.checkReachBottom();
  }

  zoomOut() {
    let newScale = this.pdfViewer.currentScale;

    newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
    newScale = Math.floor(newScale * 10) / 10;
    newScale = Math.max(MIN_SCALE, newScale);

    this.pdfViewer.currentScaleValue = newScale;
    this.updateScale(newScale);

    this.checkReachBottom();
  }

  getConstrainsts(url, headers) {
    const constrainsts = { url };

    if (headers) {
      constrainsts.withCredentials = false;
      constrainsts.httpHeaders =
        headers === true ? this.sdk.getHeaders() : headers;
    }

    if (this.isMobile) {
      constrainsts.maxImageSize = MAX_IMAGE_SIZE;
    }

    return constrainsts;
  }

  updateScale(scale) {
    this.scaleInput.value = parseInt(scale * 100) + '%';
  }

  checkReachBottom() {
    const maxValue =
      this.pdfContainer.scrollHeight - this.pdfContainer.offsetHeight - 50;
    // if (maxValue < -50) {
    // 	return false;
    // }
    if (!this.pdfContainer.querySelector('.page')) return false;
    if (this.pdfContainer.scrollTop >= maxValue) {
      if (!this.reachBottom) {
        this.reachBottom = true;
        this.onReachBottomOnce();
      }
    }
  }

  configureGestures() {
    if (!this.isMobile) return;

    const ham = new Hammer(this.pdfContainer, {
      domEvents: true,
      touchAction: 'auto'
    });

    this.pdfContainer.addEventListener(
      'touchstart',
      this.fingerDown.bind(this)
    );
    this.pdfContainer.addEventListener('touchend', this.fingerUp.bind(this));

    ham.get('pinch').set({
      enable: true
    });

    ham.get('pan').set({ direction: Hammer.DIRECTION_ALL });

    ham.on('pinch', e => {
      if (!this.startPich) {
        this.startPich = this.pdfViewer.currentScale;
      }

      let newScale = (this.startPich * e.scale).toFixed(2);
      newScale = Math.ceil(newScale * 10) / 10;
      newScale = Math.min(MAX_SCALE, newScale);

      this.pdfViewer.currentScaleValue = newScale;

      this.updateScale(newScale);
    });

    ham.on('pinchend', e => {
      this.startPich = undefined;
    });
  }

  fingerDown(e) {
    this.activeFingers = e.touches.length;
    if (this.activeFingers > 1) {
      this.pdfContainer.style.touchAction = 'none';
    } else {
      this.pdfContainer.style.touchAction = 'pan-y pan-x';
    }
  }

  fingerUp(e) {
    this.pdfContainer.style.touchAction = 'pan-y pan-x';
  }
}
