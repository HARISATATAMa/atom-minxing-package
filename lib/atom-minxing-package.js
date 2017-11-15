'use babel';

import AtomMinxingPackageView from './atom-minxing-package-view';
import { CompositeDisposable } from 'atom';

export default {

  atomMinxingPackageView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.atomMinxingPackageView = new AtomMinxingPackageView(state.atomMinxingPackageViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.atomMinxingPackageView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'atom-minxing-package:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.atomMinxingPackageView.destroy();
  },

  serialize() {
    return {
      atomMinxingPackageViewState: this.atomMinxingPackageView.serialize()
    };
  },

  toggle() {
    console.log('AtomMinxingPackage was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
