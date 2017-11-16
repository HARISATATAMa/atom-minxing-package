'use babel';

import Dialog from './dialog';
const MXAPI = require("minxing-devtools-core");


export default class WebPreviewDialog extends Dialog{
    constructor() {
        super({
            initialPath: '9200/index.html',
            select: true,
            iconClass: 'icon-file-add',
            prompt: `请输入本地web工程页面,以端口开始`
        });
    }
    onConfirm(src) {
        // src: 9200/index.html
        const err = MXAPI.Wifi.webPreview({
            src
        })
        if (err) {
            console.warn(err);
        }
        this.closePanel();
    }
}