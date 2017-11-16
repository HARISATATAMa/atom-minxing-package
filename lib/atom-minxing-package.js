'use babel';

import {
    CompositeDisposable
} from 'atom';

import AddDialog from './add-dialog';
import WebPreviewDialog from './web-preview-dialog';

const Path = require("path");

const MXAPI = require("minxing-devtools-core");

const remote = require("remote");
const dialog = remote.require("dialog") || remote["dialog"];
const commandsConfig = require('./command.json').commands;

export default {
    subscriptions: null,
    modalPanel: null,
    port: null,
    getRandomNum(min, max) {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(Math.random() * (max - min + 1)) + min
    },
    info(msg, detail) {
        console.log(msg);
        const opt = detail ? {
            detail
        } : {};
        atom.notifications.addInfo(msg, opt);
    },
    warn(msg, detail) {
        console.warn(msg);
        const opt = detail ? {
            detail
        } : {};
        atom.notifications.addWarning(msg, opt);
    },
    noActive() {
        this.warn(`检测不到活动的敏行项目！`);
    },
    invalidProject(filePath) {
        this.warn(`${filePath}不在一个有效的敏行项目中!`);
    },
    setTemplateCommand(str) {
        /**
         * str = 'Project' | 'Page';
         */
        const mainName = {
            'Project': '项目模板',
            'Page': '页面框架'
        }
        const config = MXAPI.Template[str].getConfig();
        Object.keys(config).forEach(type => {
            Object.keys(config[type]).forEach(template => {
                atom.commands.add('atom-workspace', `Minxing:add${str}Template,type=${type},template=${template}`, {
                    didDispatch: (event) => (this.atomCommandHandler({
                        event: event
                    })),
                    displayName: `敏行 Minxing：新增(${type})${mainName[str]}  ${config[type][template]}`,
                    description: `Minxing Add ${type} ${str}  ${config[type][template]}`
                })
            })
        })
    },
    activate(state) {
        const port = this.getRandomNum(1001, 9999);
        this.port = port;

        this.tempPath = Path.resolve(Path.dirname(__dirname), 'temp');
        MXAPI.clearTemp(this.tempPath);

        MXAPI.Wifi.start({
            tempPath: this.tempPath,
            port: this.port
        })

        MXAPI.Wifi.log(({
                level,
                content
            }) => {
                level = level || 'log';
                if ((level in console) && (console[level] instanceof Function)) {
                    console[level](content);
                }
            })
            .then(() => {
                console.log("启动WiFi日志服务...");
            })

        this.subscriptions = new CompositeDisposable();
        /* 项目模板指令集. */
        this.setTemplateCommand('Project');
        /* 页面模板指令集. */
        this.setTemplateCommand('Page');
        /* wifi 同步指令. */

        commandsConfig.forEach(c => {
            atom.commands.add('atom-workspace', `${c.command}`, {
                didDispatch: (event) => (this.atomCommandHandler({
                    event: event
                })),
                displayName: `${c.displayName}`,
                description: `${c.description}`
            })
        })
    },
    deactivate() {
        this.modalPanel && this.modalPanel.destroy();
        this.subscriptions.dispose();
        MXAPI.Wifi.end();
    },
    serialize() {
        return {};
    },
    getDatasetPath(event) {
        /* 获取点击事件位置的文件路径. */
        const target = event.target;
        let filePath = '';
        if (target.dataset && target.dataset.path) {
            filePath = target.dataset.path;
        } else if (target.lastChild) {
            filePath = target.lastChild.dataset.path
        }
        return filePath;
    },
    getDatasetPathOrActive(event) {
        // 获取点击事件位置或者当前打开的文件的文件路径
        let filePath = this.getDatasetPath(event);
        if (!filePath) {
            const textEditor = atom.workspace.getActiveTextEditor()
            filePath = textEditor && textEditor.getPath()
        }
        return filePath;

    },
    getActivePathOrProject(event) {
        let filePath = this.getDatasetPathOrActive(event);
        if (!filePath) {
            const projectPaths = atom.project.getPaths();
            filePath = projectPaths.length === 1 ? projectPaths[0] : filePath;
        }
        return filePath;
    },
    atomCommandHandler({
        event: event
    }) {
        const namespace = "Minxing:"
        const command = event.type;

        // 验证是否为该插件方法
        if (!(new RegExp(`^${namespace}`)).test(command)) {
            return;
        }

        const commandArr = command.substring(namespace.length, command.length).split(",");
        const funcName = commandArr[0];
        const argObj = commandArr.filter(c => c.includes('='))
            .reduce((entities, cmd) => {
                entities[cmd.split('=')[0]] = cmd.split('=')[1];
                return entities;
            }, {
                event: event
            })

        if (this[funcName] instanceof Function) {
            this[funcName](argObj)
        };
    },
    addPageTemplate({
        type,
        template,
        event
    }) {
        const filePath = this.getDatasetPathOrActive(event);
        if (!filePath) {
            this.noActive();
            return;
        }
        const projectRootInfo = MXAPI.Utils.fetchProjectRootInfoByFile(filePath);
        if (!projectRootInfo) {
            this.invalidProject(filePath);
            return;
        }
        if (type !== projectRootInfo.type) {
            this.warn(`模版类型与项目类型不符！`);
            return;
        }
        const outputPath = MXAPI.Template.Page.getOutputPath({
            type,
            projectRootPath: projectRootInfo.project,
            filePath
        });
        const addDialog = new AddDialog(type, outputPath, projectRootInfo.project, template);
        addDialog.attach();
    },
    addProjectTemplate({
        type,
        template,
        event
    }) {
        let name = template

        dialog.showSaveDialog({
            title: "创建 敏行项目 项目模板",

            properties: ['createDirectory']
        }, (project) => {
            if (!project) {
                console.log("用户取消操作")
                return
            }
            let projectRootPath = project;
            let workspacePath = Path.resolve(projectRootPath, "../");
            name = Path.basename(projectRootPath)
            MXAPI.Template.Project.add({
                type: type,
                name: name,
                template: template,
                output: workspacePath
            })
            let newAppProjectPath = Path.resolve(workspacePath, name);
            atom.project.addPath(newAppProjectPath);
        })
    },
    webPreviewWifi({
        event
    }) {
        const {
            port,
            ip,
            connectionCount
        } = MXAPI.Wifi.info()
        if (0 === connectionCount) {
            this.warn("当前网速过慢或没有设备处于连接状态,可能会影响相关同步功能的使用")
        }
        
        const webPreviewDialog = new WebPreviewDialog();
        webPreviewDialog.attach();
    },
    previewWifi({
        event
    }) {
        const {
            port,
            ip,
            connectionCount
        } = MXAPI.Wifi.info()
        if (0 === connectionCount) {
            this.warn("当前网速过慢或没有设备处于连接状态,可能会影响相关同步功能的使用")
        }

        const filePath = this.getDatasetPathOrActive(event);
        if (!filePath) {
            this.warn("似乎没有可供预览的文件")
            return;
        }
        const fileName = Path.basename(filePath);
        const htmlReg = /(.*\.html)$/;
        if (!htmlReg.test(fileName)) {
            this.warn("似乎没有可供预览的文件");
            return;
        }

        MXAPI.Wifi.preview({
            file: filePath
        })
        this.info(`${fileName}同步成功,请在手机上查看运行效果!`);
    },
    syncWifi({
        event
    }) {
        this.syncAllWifi({
            event: event,
            syncAll: false
        })
    },
    syncAllWifi({
        event,
        syncAll = true
    }) {
        const {
            port,
            ip,
            connectionCount
        } = MXAPI.Wifi.info();

        if (0 === connectionCount) {
            this.warn("当前网速过慢或没有设备处于连接状态,可能会影响相关同步功能的使用");
            return;
        }

        const filePath = this.getActivePathOrProject(event);
        if (!filePath) {
            this.noActive();
            return;
        }

        const projectRootInfo = MXAPI.Utils.fetchProjectRootInfoByFile(filePath);
        if (!projectRootInfo) {
            this.invalidProject(filePath);
            return;
        };

        syncAll = syncAll ? 1 : 0;

        MXAPI.Wifi.sync({
            project: projectRootInfo.project,
            updateAll: syncAll
        });
        const projectName = Path.basename(projectRootInfo.project);
        this.info(`${projectName}同步成功,请在手机上查看运行效果!`);
    },
    wifiLog({
        event
    }) {
        atom.openDevTools()
            .then(() => {
                this.info("请在Atom控制台查看日志信息");
            })
    },
    wifiInfo({
        event
    }) {
        const {
            port,
            ip,
            connectionCount
        } = MXAPI.Wifi.info();

        atom.openDevTools()
            .then(() => {
                const tip = `IP :${JSON.stringify(ip)}\n端口:${port}\n设备连接数:${connectionCount}`
                const detail = "还可在Atom控制台末尾随时查看;ip地址有可能有多个,哪个可用,取决你和电脑所处的网络";
                this.info(tip, detail);
            })
    },
    buildToMinxing({
        event
    }) {
        const filePath = this.getActivePathOrProject(event);
        if (!filePath) {
            this.noActive();
            return;
        }
        const projectRootInfo = MXAPI.Utils.fetchProjectRootInfoByFile(filePath);

        if (!projectRootInfo) {
            this.invalidProject(filePath);
            return;
        };
        dialog.showOpenDialog({
            title: "选择打包后的文件存放目录",
            properties: ['openDirectory']
        }, (savePathArr) => {
            if (!savePathArr || savePathArr.length === 0) {
                return;
            }
            const savePath = savePathArr[0];

            MXAPI.build({
                    projectRootPath: projectRootInfo.project,
                    savePath
                })
                .then(appInfo => {
                    const zipPath = appInfo.path;
                    const tip = `已成功打包为敏行插件应用!目录为${zipPath}`;
                    const detail = "还可在Atom控制台末尾随时查看";
                    this.info(tip, detail);
                })
                .catch(e => {
                    const tip = `打包出错!`;
                    atom.notifications.addError(tip, {
                        "detail": `${e}`
                    })
                });
        })
    }
};