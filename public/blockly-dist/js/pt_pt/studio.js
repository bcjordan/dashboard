(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
var utils = require('./utils');
var requiredBlockUtils = require('./required_block_utils');
window.BlocklyApps = require('./base');

if (typeof global !== 'undefined') {
  global.BlocklyApps = window.BlocklyApps;
}

var addReadyListener = require('./dom').addReadyListener;
var blocksCommon = require('./blocksCommon');

function StubDialog() {
  for (var argument in arguments) {
    console.log(argument);
  }
}
StubDialog.prototype.show = function() {
  console.log("Showing Dialog");
  console.log(this);
};
StubDialog.prototype.hide = function() {
  console.log("Hiding Dialog");
  console.log(this);
};

module.exports = function(app, levels, options) {

  // If a levelId is not provided, then options.level is specified in full.
  // Otherwise, options.level overrides resolved level on a per-property basis.
  if (options.levelId) {
    var level = levels[options.levelId];
    options.level = options.level || {};
    options.level.id = options.levelId;
    for (var prop in options.level) {
      level[prop] = options.level[prop];
    }

    if (options.level.levelBuilderRequiredBlocks) {
      level.requiredBlocks = requiredBlockUtils.makeTestsFromBuilderRequiredBlocks(
          options.level.levelBuilderRequiredBlocks);
    }

    options.level = level;
  }

  options.Dialog = options.Dialog || StubDialog;

  BlocklyApps.BASE_URL = options.baseUrl;
  BlocklyApps.CACHE_BUST = options.cacheBust;
  BlocklyApps.LOCALE = options.locale || BlocklyApps.LOCALE;

  BlocklyApps.assetUrl = function(path) {
    var url = options.baseUrl + path;
    /*if (BlocklyApps.CACHE_BUST) {
      return url + '?v=' + options.cacheBust;
    } else {*/
      return url;
    /*}*/
  };

  options.skin = options.skinsModule.load(BlocklyApps.assetUrl, options.skinId);
  var blockInstallOptions = {
    skin: options.skin,
    isK1: options.level && options.level.is_k1
  };
  blocksCommon.install(Blockly, blockInstallOptions);
  options.blocksModule.install(Blockly, blockInstallOptions);

  addReadyListener(function() {
    if (options.readonly) {
      BlocklyApps.initReadonly(options);
    } else {
      app.init(options);
      if (options.onInitialize) {
        options.onInitialize();
      }
    }
  });

};

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./base":2,"./blocksCommon":4,"./dom":7,"./required_block_utils":10,"./utils":34}],2:[function(require,module,exports){
/**
 * Blockly Apps: Common code
 *
 * Copyright 2013 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Common support code for Blockly apps.
 * @author fraser@google.com (Neil Fraser)
 */
"use strict";
var BlocklyApps = module.exports;
var msg = require('../locale/pt_pt/common');
var parseXmlElement = require('./xml').parseElement;
var feedback = require('./feedback.js');
var dom = require('./dom');
var utils = require('./utils');
var builder = require('./builder');
var Slider = require('./slider');
var _ = require('./lodash');

//TODO: These should be members of a BlocklyApp instance.
var onAttempt;
var onContinue;
var onResetPressed;
var backToPreviousLevel;

/**
 * The parent directory of the apps. Contains common.js.
 */
BlocklyApps.BASE_URL = undefined;

/**
 * If truthy, a version number to be appended to asset urls.
 */
BlocklyApps.CACHE_BUST = undefined;

/**
 * The current locale code.
 */
BlocklyApps.LOCALE = 'en_us';

/**
 * The minimum width of a playable whole blockly game.
 */
BlocklyApps.MIN_WIDTH = 900;
BlocklyApps.MIN_MOBILE_SHARE_WIDTH = 450;
BlocklyApps.MIN_MOBILE_NO_PADDING_SHARE_WIDTH = 400;

/**
 * If the user presses backspace, stop propagation - this prevents blockly
 * from eating the backspace key
 * @param {!Event} e Keyboard event.
 */
var codeKeyDown = function(e) {
  if (e.keyCode == 8) {
    e.stopPropagation();
  }
};

/**
 * Common startup tasks for all apps.
 */
BlocklyApps.init = function(config) {
  if (!config) {
    config = {};
  }

  BlocklyApps.share = config.share;
  BlocklyApps.noPadding = config.no_padding;

  BlocklyApps.IDEAL_BLOCK_NUM = config.level.ideal || Infinity;
  BlocklyApps.REQUIRED_BLOCKS = config.level.requiredBlocks || [];

  // enableShowCode defaults to true if not defined
  BlocklyApps.enableShowCode = (config.enableShowCode === false) ? false : true;

  // If the level has no ideal block count, don't show a block count. If it does
  // have an ideal, show block count unless explicitly configured not to.
  if (config.level && (config.level.ideal === undefined || config.level.ideal === Infinity)) {
    BlocklyApps.enableShowBlockCount = false;
  } else {
    BlocklyApps.enableShowBlockCount = (config.enableShowBlockCount === false) ? false : true;
  }

  // Store configuration.
  onAttempt = config.onAttempt || function(report) {
    console.log('Attempt!');
    console.log(report);
    if (report.onComplete) {
      report.onComplete();
    }
  };
  onContinue = config.onContinue || function() {
    console.log('Continue!');
  };
  onResetPressed = config.onResetPressed || function() {
    console.log('Reset!');
  };
  backToPreviousLevel = config.backToPreviousLevel || function() {};

  var container = document.getElementById(config.containerId);
  container.innerHTML = config.html;
  var runButton = container.querySelector('#runButton');
  var resetButton = container.querySelector('#resetButton');
  var throttledRunClick = _.debounce(BlocklyApps.runButtonClick, 250, true);
  dom.addClickTouchEvent(runButton, throttledRunClick);
  dom.addClickTouchEvent(resetButton, BlocklyApps.resetButtonClick);

  var belowViz = document.getElementById('belowVisualization');
  if (config.referenceArea) {
    belowViz.appendChild(config.referenceArea());
  }

  if (config.hide_source) {
    var blockly = container.querySelector('#blockly');
    container.className = 'hide-source';
    blockly.style.display = 'none';
    // For share page on mobile, do not show this part.
    if (!BlocklyApps.share || !dom.isMobile()) {
      var buttonRow = runButton.parentElement;
      var openWorkspace = document.createElement('button');
      openWorkspace.setAttribute('id', 'open-workspace');
      openWorkspace.appendChild(document.createTextNode(msg.openWorkspace()));

      belowViz.appendChild(feedback.createSharingDiv({
        response: {
          level_source: window.location
        },
        twitter: config.twitter
      }));

      dom.addClickTouchEvent(openWorkspace, function() {
        // Redirect user to /edit version of this page. It would be better
        // to just turn on the workspace but there are rendering issues
        // with that.
        window.location.href = window.location.href + '/edit';
      });

      buttonRow.appendChild(openWorkspace);
    }
  }

  // 1. Move the buttons, 2. Hide the slider in the share page for mobile.
  if (BlocklyApps.share && dom.isMobile()) {
    var sliderCell = document.getElementById('slider-cell');
    if (sliderCell) {
      sliderCell.style.display = 'none';
    }
    var belowVisualization = document.getElementById('belowVisualization');
    if (belowVisualization) {
      belowVisualization.style.display = 'block';
      belowVisualization.style.marginLeft = '0px';
      if (BlocklyApps.noPadding) {
        // Shift run and reset buttons off the left edge if we have no padding
        if (runButton) {
          runButton.style.marginLeft = '30px';
        }
        if (resetButton) {
          resetButton.style.marginLeft = '30px';
        }
      }
    }
  }

  // Show flappy upsale on desktop and mobile.  Show learn upsale only on desktop
  if (BlocklyApps.share) {
    var upSale = document.createElement('div');
    if (config.makeYourOwn) {
      upSale.innerHTML = require('./templates/makeYourOwn.html')({
        data: {
          makeUrl: config.makeUrl,
          makeString: config.makeString,
          makeImage: config.makeImage
        }
      });
      if (BlocklyApps.noPadding) {
        upSale.style.marginLeft = '30px';
      }
    } else if (!dom.isMobile()) {
      upSale.innerHTML = require('./templates/learn.html')();
    }
    belowViz.appendChild(upSale);
  }

  // Record time at initialization.
  BlocklyApps.initTime = new Date().getTime();

  // Fixes viewport for small screens.
  var viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    var widthDimension;
    var minWidth;
    if (BlocklyApps.share && dom.isMobile()) {
      // for mobile sharing, don't assume landscape mode, use screen.width
      widthDimension = screen.width;
      minWidth = BlocklyApps.noPadding ?
                    BlocklyApps.MIN_MOBILE_NO_PADDING_SHARE_WIDTH :
                    BlocklyApps.MIN_MOBILE_SHARE_WIDTH;
    }
    else {
      // assume we are in landscape mode, so width is the longer of the two
      widthDimension = Math.max(screen.width, screen.height);
      minWidth = BlocklyApps.MIN_WIDTH;
    }
    var width = Math.max(minWidth, widthDimension);
    var scale = widthDimension / width;
    var content = ['width=' + width,
                   'minimal-ui',
                   'initial-scale=' + scale,
                   'maximum-scale=' + scale,
                   'minimum-scale=' + scale,
                   'target-densityDpi=device-dpi',
                   'user-scalable=no'];
    viewport.setAttribute('content', content.join(', '));
  }

  if (config.level.editCode) {
    BlocklyApps.editCode = true;
    var codeTextbox = document.getElementById('codeTextbox');
    var codeFunctions = config.level.codeFunctions;
    // Insert hint text from level codeFunctions into editCode area
    if (codeFunctions) {
      var hintText = "";
      for (var i = 0; i < codeFunctions.length; i++) {
        hintText = hintText + " " + codeFunctions[i].func + "();";
      }
      var html = utils.escapeHtml(msg.typeFuncs()).replace('%1', hintText);
      codeTextbox.innerHTML += '// ' + html + '<br><br><br>';
    }
    // Needed to prevent blockly from swallowing up the backspace key
    codeTextbox.addEventListener('keydown', codeKeyDown, true);
  }

  BlocklyApps.Dialog = config.Dialog;

  var showCode = document.getElementById('show-code-header');
  if (showCode && BlocklyApps.enableShowCode) {
    dom.addClickTouchEvent(showCode, function() {
      feedback.showGeneratedCode(BlocklyApps.Dialog);
    });
  }

  var blockCount = document.getElementById('workspace-header');
  if (blockCount && !BlocklyApps.enableShowBlockCount) {
    blockCount.style.visibility = 'hidden';
  }

  BlocklyApps.ICON = config.skin.staticAvatar;
  BlocklyApps.SMALL_ICON = config.skin.smallStaticAvatar;
  BlocklyApps.WIN_ICON = config.skin.winAvatar;
  BlocklyApps.FAILURE_ICON = config.skin.failureAvatar;

  if (config.level.instructionsIcon) {
    BlocklyApps.ICON = config.skin[config.level.instructionsIcon];
    BlocklyApps.WIN_ICON = config.skin[config.level.instructionsIcon];
  }

  if (config.showInstructionsWrapper) {
    config.showInstructionsWrapper(function() {
      showInstructions(config.level);
    });
  }

  // The share page does not show the rotateContainer.
  if (BlocklyApps.share) {
    var rotateContainer = document.getElementById('rotateContainer');
    if (rotateContainer) {
      rotateContainer.style.display = 'none';
    }
  }
  var orientationHandler = function() {
    window.scrollTo(0, 0);  // Browsers like to mess with scroll on rotate.
    var rotateContainer = document.getElementById('rotateContainer');
    rotateContainer.style.width = window.innerWidth + 'px';
    rotateContainer.style.height = window.innerHeight + 'px';
  };
  window.addEventListener('orientationchange', orientationHandler);
  orientationHandler();

  if (config.loadAudio) {
    config.loadAudio();
  }

  if (config.level.instructions) {
    var promptDiv = document.getElementById('prompt');
    dom.setText(promptDiv, config.level.instructions);

    var promptIcon = document.getElementById('prompt-icon');
    promptIcon.src = BlocklyApps.SMALL_ICON;
  }

  // Allow empty blocks if editing blocks.
  if (config.level.edit_blocks) {
    BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = false;
  }

  var div = document.getElementById('blockly');
  var options = {
    toolbox: config.level.toolbox
  };
  ['trashcan', 'scrollbars', 'concreteBlocks', 'varsInGlobals', 'grayOutUndeletableBlocks'].forEach(
    function (prop) {
      if (config[prop] !== undefined) {
        options[prop] = config[prop];
      }
    });
  BlocklyApps.inject(div, options);

  if (config.afterInject) {
    config.afterInject();
  }

  // Initialize the slider.
  var slider = document.getElementById('slider');
  if (slider) {
    Turtle.speedSlider = new Slider(10, 35, 130, slider);

    // Change default speed (eg Speed up levels that have lots of steps).
    if (config.level.sliderSpeed) {
      Turtle.speedSlider.setValue(config.level.sliderSpeed);
    }
  }

  if (config.level.editCode) {
    document.getElementById('codeTextbox').style.display = 'block';
    div.style.display = 'none';
  }

  // Add the starting block(s).
  var startBlocks = config.level.startBlocks || '';
  startBlocks = BlocklyApps.arrangeBlockPosition(startBlocks, config.blockArrangement);
  BlocklyApps.loadBlocks(startBlocks);
  BlocklyApps.numRequiredTopBlocks = config.preventExtraTopLevelBlocks ?
    Blockly.mainWorkspace.getTopBlocks().length : null;

  var onResize = function() {
    BlocklyApps.onResize(config.getDisplayWidth());
  };

  // listen for scroll and resize to ensure onResize() is called
  window.addEventListener('scroll', function() {
    onResize();
    Blockly.fireUiEvent(window, 'resize');
  });
  window.addEventListener('resize', onResize);

  // call initial onResize() asynchronously - need 100ms delay to work
  // around relayout which changes height on the left side to the proper
  // value
  window.setTimeout(function() {
      onResize();
      Blockly.fireUiEvent(window, 'resize');
    },
    100);

  BlocklyApps.reset(true);

  // Add display of blocks used.
  setIdealBlockNumber();
  Blockly.addChangeListener(function() {
    BlocklyApps.updateBlockCount();
  });
};

exports.playAudio = function(name, options) {
  Blockly.playAudio(name, options);
};

exports.stopLoopingAudio = function(name) {
  Blockly.stopLoopingAudio(name);
};

/**
 * @param {Object} options Configuration parameters for Blockly. Parameters are
 * optional and include:
 *  - {string} path The root path to the /blockly directory, defaults to the
 *    the directory in which this script is located.
 *  - {boolean} rtl True if the current language right to left.
 *  - {DomElement} toolbox The element in which to insert the toolbox,
 *    defaults to the element with 'toolbox'.
 *  - {boolean} trashcan True if the trashcan should be displayed, defaults to
 *    true.
 * @param {DomElement} div The parent div in which to insert Blockly.
 */
exports.inject = function(div, options) {
  var defaults = {
    assetUrl: BlocklyApps.assetUrl,
    rtl: BlocklyApps.isRtl(),
    toolbox: document.getElementById('toolbox'),
    trashcan: true
  };
  Blockly.inject(div, utils.extend(defaults, options));
};

/**
 * Returns true if the current HTML page is in right-to-left language mode.
 */
BlocklyApps.isRtl = function() {
  var head = document.getElementsByTagName('head')[0];
  if (head && head.parentElement) {
    var dir = head.parentElement.getAttribute('dir');
    return (dir && dir.toLowerCase() == 'rtl');
  } else {
    return false;
  }
};

BlocklyApps.localeDirection = function() {
  return (BlocklyApps.isRtl() ? 'rtl' : 'ltr');
};

/**
 * Initialize Blockly for a readonly iframe.  Called on page load.
 * XML argument may be generated from the console with:
 * Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(Blockly.mainWorkspace)).slice(5, -6)
 */
BlocklyApps.initReadonly = function(options) {
  Blockly.inject(document.getElementById('blockly'), {
    assetUrl: BlocklyApps.assetUrl,
    readOnly: true,
    rtl: BlocklyApps.isRtl(),
    scrollbars: false
  });
  BlocklyApps.loadBlocks(options.blocks);
};

/**
 * Load the editor with blocks.
 * @param {string} blocksXml Text representation of blocks.
 */
BlocklyApps.loadBlocks = function(blocksXml) {
  var xml = parseXmlElement(blocksXml);
  Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, xml);
};

BlocklyApps.BLOCK_X_COORDINATE = 70;
BlocklyApps.BLOCK_Y_COORDINATE = 30;
BlocklyApps.BLOCK_Y_COORDINATE_INTERVAL = 200;

/**
 * Spreading out the top blocks in workspace if it is not already set.
 */
BlocklyApps.arrangeBlockPosition = function(startBlocks, arrangement) {
  var type, arrangeX, arrangeY;
  var xml = parseXmlElement(startBlocks);
  var numberOfPlacedBlocks = 0;
  for (var x = 0, xmlChild; xml.childNodes && x < xml.childNodes.length; x++) {
    xmlChild = xml.childNodes[x];

    // Only look at element nodes
    if (xmlChild.nodeType === 1) {
      // look to see if we have a predefined arrangement for this type
      type = xmlChild.getAttribute('type');
      arrangeX = arrangement && arrangement[type] ? arrangement[type].x : null;
      arrangeY = arrangement && arrangement[type] ? arrangement[type].y : null;

      xmlChild.setAttribute('x', xmlChild.getAttribute('x') || arrangeX ||
                            BlocklyApps.BLOCK_X_COORDINATE);
      xmlChild.setAttribute('y', xmlChild.getAttribute('y') || arrangeY ||
                            BlocklyApps.BLOCK_Y_COORDINATE +
                            BlocklyApps.BLOCK_Y_COORDINATE_INTERVAL * numberOfPlacedBlocks);
      numberOfPlacedBlocks += 1;
    }
  }
  return Blockly.Xml.domToText(xml);
};

var showInstructions = function(level) {
  if (!level.instructions) {
    // Skip instructions if empty
    return;
  }

  var instructionsDiv = document.createElement('div');
  instructionsDiv.innerHTML = require('./templates/instructions.html')(level);

  var buttons = document.createElement('div');
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      ok: true
    }
  });

  instructionsDiv.appendChild(buttons);

  var dialog = feedback.createModalDialogWithIcon({
      Dialog: BlocklyApps.Dialog,
      contentDiv: instructionsDiv,
      icon: BlocklyApps.ICON,
      defaultBtnSelector: '#ok-button'
      });
  var okayButton = buttons.querySelector('#ok-button');
  if (okayButton) {
    dom.addClickTouchEvent(okayButton, function() {
      dialog.hide();
    });
  }

  dialog.show();
};

/**
 *  Resizes the blockly workspace.
 */
BlocklyApps.onResize = function(gameWidth) {
  gameWidth = gameWidth || 0;
  var blocklyDiv = document.getElementById('blockly');
  var codeTextbox = document.getElementById('codeTextbox');

  // resize either blockly or codetextbox
  var div = BlocklyApps.editCode ? codeTextbox : blocklyDiv;

  var blocklyDivParent = blocklyDiv.parentNode;
  var parentStyle = window.getComputedStyle ?
                    window.getComputedStyle(blocklyDivParent) :
                    blocklyDivParent.currentStyle;  // IE

  var parentWidth = parseInt(parentStyle.width, 10);
  var parentHeight = parseInt(parentStyle.height, 10);

  var headers = document.getElementById('headers');
  var headersStyle = window.getComputedStyle ?
                       window.getComputedStyle(headers) :
                       headers.currentStyle;  // IE
  var headersHeight = parseInt(headersStyle.height, 10);

  div.style.top = blocklyDivParent.offsetTop + 'px';
  div.style.width = (parentWidth - (gameWidth + 15)) + 'px';
  if (BlocklyApps.isRtl()) {
    div.style.marginRight = (gameWidth + 15) + 'px';
  }
  else {
    div.style.marginLeft = (gameWidth + 15) + 'px';
  }
  // reduce height by headers height because blockly isn't aware of headers
  // and will size its svg element to be too tall
  div.style.height = (parentHeight - headersHeight) + 'px';

  BlocklyApps.resizeHeaders();
};

BlocklyApps.resizeHeaders = function() {
  var categoriesWidth = 0;
  var categories = Blockly.Toolbox.HtmlDiv;
  if (categories) {
    categoriesWidth = parseInt(window.getComputedStyle(categories).width, 10);
  }

  var workspaceWidth = Blockly.getWorkspaceWidth();
  var toolboxWidth = Blockly.getToolboxWidth();

  var workspaceHeader = document.getElementById('workspace-header');
  var toolboxHeader = document.getElementById('toolbox-header');
  var showCodeHeader = document.getElementById('show-code-header');

  var showCodeWidth;
  if (BlocklyApps.enableShowCode) {
    showCodeWidth = parseInt(window.getComputedStyle(showCodeHeader).width, 10);
  }
  else {
    showCodeWidth = 0;
    showCodeHeader.style.display = "none";
  }

  toolboxHeader.style.width = (categoriesWidth + toolboxWidth) + 'px';
  workspaceHeader.style.width = (workspaceWidth -
                                 toolboxWidth -
                                 showCodeWidth) + 'px';
};

/**
 * Highlight the block (or clear highlighting).
 * @param {?string} id ID of block that triggered this action.
 * @param {boolean} spotlight Optional.  Highlight entire block if true
 */
BlocklyApps.highlight = function(id, spotlight) {
  if (id) {
    var m = id.match(/^block_id_(\d+)$/);
    if (m) {
      id = m[1];
    }
  }

  Blockly.mainWorkspace.highlightBlock(id, spotlight);
};

/**
 * Remove highlighting from all blocks
 */
BlocklyApps.clearHighlighting = function () {
  BlocklyApps.highlight(null);
};

// The following properties get their non-default values set by the application.

/**
 * Whether to alert user to empty blocks, short-circuiting all other tests.
 */
BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = undefined;

/**
 * The ideal number of blocks to solve this level.  Users only get 2
 * stars if they use more than this number.
 * @type {!number=}
 */
BlocklyApps.IDEAL_BLOCK_NUM = undefined;

/**
 * An array of dictionaries representing required blocks.  Keys are:
 * - test (required): A test whether the block is present, either:
 *   - A string, in which case the string is searched for in the generated code.
 *   - A single-argument function is called on each user-added block
 *     individually.  If any call returns true, the block is deemed present.
 *     "User-added" blocks are ones that are neither disabled or undeletable.
 * - type (required): The type of block to be produced for display to the user
 *   if the test failed.
 * - titles (optional): A dictionary, where, for each KEY-VALUE pair, this is
 *   added to the block definition: <title name="KEY">VALUE</title>.
 * - value (optional): A dictionary, where, for each KEY-VALUE pair, this is
 *   added to the block definition: <value name="KEY">VALUE</value>
 * - extra (optional): A string that should be blacked between the "block"
 *   start and end tags.
 * @type {!Array=}
 */
BlocklyApps.REQUIRED_BLOCKS = undefined;

/**
 * The number of required blocks to give hints about at any one time.
 * Set this to Infinity to show all.
 * @type {!number=}
 */
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = undefined;

/**
 * Flag indicating whether the last program run completed the level.
 * @type {?boolean}
 */
BlocklyApps.levelComplete = null;

/**
 * The number of attempts (how many times the run button has been pressed)
 * @type {?number}
 */
BlocklyApps.attempts = 0;

/**
 * Stores the time at init. The delta to current time is used for logging
 * and reporting to capture how long it took to arrive at an attempt.
 * @type {?number}
 */
BlocklyApps.initTime = undefined;

/**
 * Reset the playing field to the start position and kill any pending
 * animation tasks.  This will typically be replaced by an application.
 * @param {boolean} first True if an opening animation is to be played.
 */
BlocklyApps.reset = function(first) {};

// Override to change run behavior.
BlocklyApps.runButtonClick = function() {};

/**
 * Enumeration of test results.
 * BlocklyApps.getTestResults() runs checks in the below order.
 * EMPTY_BLOCKS_FAIL can only occur if BlocklyApps.CHECK_FOR_EMPTY_BLOCKS true.
 */
BlocklyApps.TestResults = {
  // Default value before any tests are run.
  NO_TESTS_RUN: -1,

  // Zero stars.  The level was not solved.
  EMPTY_BLOCK_FAIL: 1,        // A container block, such as "repeat", was empty.
  TOO_FEW_BLOCKS_FAIL: 2,     // Fewer than the ideal number of blocks used.
  LEVEL_INCOMPLETE_FAIL: 3,   // Default failure to complete a level.
  MISSING_BLOCK_UNFINISHED: 4,// A required block was not used.
  EXTRA_TOP_BLOCKS_FAIL: 5,   // There was more than one top-level block.

  // One star.  The level was solved in an unacceptable way.
  MISSING_BLOCK_FINISHED: 10, // The level was solved without required block.
  OTHER_1_STAR_FAIL: 11,      // Application-specific 1-star failure.

  // Two stars.  The level was solved in an acceptable, but not ideal, manner.
  TOO_MANY_BLOCKS_FAIL: 20,   // More than the ideal number of blocks were used.
  OTHER_2_STAR_FAIL: 21,      // Application-specific 2-star failure.
  FLAPPY_SPECIFIC_FAIL: 22,   // Flappy app failure. TODO: Fold into prior case.

  // Other.
  FREE_PLAY: 30,              // The user is in free-play mode.
  EDIT_BLOCKS: 70,            // The user is creating/editing a new level.

  // Three stars.  The level was solved in the ideal manner.
  ALL_PASS: 100               // 3 stars.
};

// Methods for determining and displaying feedback.

/**
 * Display feedback based on test results.  The test results must be
 * explicitly provided.
 * @param {{feedbackType: number}} Test results (a constant property of
 *     BlocklyApps.TestResults).
 */
BlocklyApps.displayFeedback = function(options) {
  options.Dialog = BlocklyApps.Dialog;
  options.onContinue = onContinue;
  options.backToPreviousLevel = backToPreviousLevel;

  // Special test code for edit blocks.
  if (options.level.edit_blocks) {
    options.feedbackType = BlocklyApps.TestResults.EDIT_BLOCKS;
  }

  feedback.displayFeedback(options);
};

BlocklyApps.getTestResults = function() {
  return feedback.getTestResults();
};

/**
 * Report back to the server, if available.
 * @param {object} options - parameter block which includes:
 * {string} app The name of the application.
 * {number} id A unique identifier generated when the page was loaded.
 * {string} level The ID of the current level.
 * {number} result An indicator of the success of the code.
 * {number} testResult More specific data on success or failure of code.
 * {string} program The user program, which will get URL-encoded.
 * {function} onComplete Function to be called upon completion.
 */
BlocklyApps.report = function(options) {
  // copy from options: app, level, result, testResult, program, onComplete
  var report = options;
  report.pass = feedback.canContinueToNextLevel(options.testResults);
  report.time = ((new Date().getTime()) - BlocklyApps.initTime);
  report.attempt = BlocklyApps.attempts;
  report.lines = feedback.getNumBlocksUsed();

  // Disable the run button until onReportComplete is called.
  if (!BlocklyApps.share) {
    var onAttemptCallback = (function() {
      return function(builderDetails) {
        for (var option in builderDetails) {
          report[option] = builderDetails[option];
        }
        onAttempt(report);
      };
    })();

    // If this is the level builder, go to builderForm to get more info from
    // the level builder.
    if (options.builder) {
      builder.builderForm(onAttemptCallback);
    } else {
      onAttemptCallback();
    }
  }
};

/**
 * Click the reset button.  Reset the application.
 */
BlocklyApps.resetButtonClick = function() {
  onResetPressed();
  document.getElementById('runButton').style.display = 'inline';
  document.getElementById('resetButton').style.display = 'none';
  BlocklyApps.clearHighlighting();
  Blockly.mainWorkspace.setEnableToolbox(true);
  Blockly.mainWorkspace.traceOn(false);
  BlocklyApps.reset(false);
};

/**
 * Set the ideal Number of blocks.
 */
var setIdealBlockNumber = function() {
  var element = document.getElementById('idealBlockNumber');
  if (element) {
    element.innerHTML = '';  // Remove existing children or text.
    element.appendChild(document.createTextNode(
        getIdealBlockNumberMsg()));
  }
};

/**
 * Add count of blocks used.
 */
exports.updateBlockCount = function() {
  // If the number of block used is bigger than the ideal number of blocks,
  // set it to be yellow, otherwise, keep it as black.
  var element = document.getElementById('blockUsed');
  if (BlocklyApps.IDEAL_BLOCK_NUM < feedback.getNumEnabledBlocks()) {
    element.className = "block-counter-overflow";
  } else {
    element.className = "block-counter-default";
  }

  // Update number of blocks used.
  if (element) {
    element.innerHTML = '';  // Remove existing children or text.
    element.appendChild(document.createTextNode(
        feedback.getNumEnabledBlocks()));
  }
};

var getIdealBlockNumberMsg = function() {
  return BlocklyApps.IDEAL_BLOCK_NUM === Infinity ?
      msg.infinity() : BlocklyApps.IDEAL_BLOCK_NUM;
};

},{"../locale/pt_pt/common":36,"./builder":5,"./dom":7,"./feedback.js":8,"./lodash":9,"./slider":12,"./templates/buttons.html":24,"./templates/instructions.html":26,"./templates/learn.html":27,"./templates/makeYourOwn.html":28,"./utils":34,"./xml":35}],3:[function(require,module,exports){
var xml = require('./xml');

exports.createToolbox = function(blocks) {
  return '<xml id="toolbox" style="display: none;">' + blocks + '</xml>';
};

exports.blockOfType = function(type) {
  return '<block type="' + type + '"></block>';
};

exports.blockWithNext = function (type, child) {
  return '<block type="' + type + '"><next>' + child + '</next></block>';
};

/**
 * Give a list of types, returns the xml assuming each block is a child of
 * the previous block.
 */
exports.blocksFromList = function (types) {
  if (types.length === 1) {
    return this.blockOfType(types[0]);
  }

  return this.blockWithNext(types[0], this.blocksFromList(types.slice(1)));
};

exports.createCategory = function(name, blocks, custom) {
  return '<category name="' + name + '"' +
          (custom ? ' custom="' + custom + '"' : '') +
          '>' + blocks + '</category>';
};

/**
 * Generate a simple block with a plain title and next/previous connectors.
 */
exports.generateSimpleBlock = function (blockly, generator, options) {
  ['name', 'title', 'tooltip', 'functionName'].forEach(function (param) {
    if (!options[param]) {
      throw new Error('generateSimpleBlock requires param "' + param + '"');
    }
  });

  var name = options.name;
  var helpUrl = options.helpUrl || ""; // optional param
  var title = options.title;
  var tooltip = options.tooltip;
  var functionName = options.functionName;

  blockly.Blocks[name] = {
    helpUrl: helpUrl,
    init: function() {
      // Note: has a fixed HSV.  Could make this customizable if need be
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(title);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(tooltip);
    }
  };

  generator[name] = function() {
    // Generate JavaScript for putting dirt on to a tile.
    return functionName + '(\'block_id_' + this.id + '\');\n';
  };
};

/**
 * Generates a single block from a <block/> DOM element, adding it to the main workspace
 * @param blockDOM {Element}
 * @returns {*}
 */
exports.domToBlock = function(blockDOM) {
  return Blockly.Xml.domToBlock_(Blockly.mainWorkspace, blockDOM);
};

/**
 * Generates a single block from a block XML string—e.g., <block type="testBlock"></block>,
 * and adds it to the main workspace
 * @param blockDOMString
 * @returns {*}
 */
exports.domStringToBlock = function(blockDOMString) {
  return exports.domToBlock(xml.parseElement(blockDOMString).firstChild);
};

},{"./xml":35}],4:[function(require,module,exports){
/**
 * Defines blocks useful in multiple blockly apps
 */
'use strict';

/**
 * Install extensions to Blockly's language and JavaScript generator
 * @param blockly instance of Blockly
 */
exports.install = function(blockly, blockInstallOptions) {
  var skin = blockInstallOptions.skin;
  // Re-uses the repeat block generator from core
  blockly.JavaScript.controls_repeat_simplified = blockly.JavaScript.controls_repeat;

  blockly.Blocks.controls_repeat_simplified = {
    // Repeat n times (internal number) with simplified UI
    init: function() {
      this.setHelpUrl(blockly.Msg.CONTROLS_REPEAT_HELPURL);
      this.setHSV(322, 0.90, 0.95);
      this.appendDummyInput()
        .appendTitle(blockly.Msg.CONTROLS_REPEAT_TITLE_REPEAT)
        .appendTitle(new Blockly.FieldTextInput('10',
          blockly.FieldTextInput.nonnegativeIntegerValidator), 'TIMES');
      this.appendStatementInput('DO')
        .appendTitle(new blockly.FieldImage(skin.repeatImage));
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(blockly.Msg.CONTROLS_REPEAT_TOOLTIP);
    }
  };
};

},{}],5:[function(require,module,exports){
var feedback = require('./feedback.js');
var dom = require('./dom.js');
var utils = require('./utils.js');
var url = require('url');
// Builds the dom to get more info from the user. After user enters info
// and click "create level" onAttemptCallback is called to deliver the info
// to the server.
exports.builderForm = function(onAttemptCallback) {
  var builderDetails = document.createElement('div');
  builderDetails.innerHTML = require('./templates/builder.html')();
  var dialog = feedback.createModalDialogWithIcon({
    Dialog: BlocklyApps.Dialog,
    contentDiv: builderDetails,
    icon: BlocklyApps.ICON
  });
  var createLevelButton = document.getElementById('create-level-button');
  dom.addClickTouchEvent(createLevelButton, function() {
    var instructions = builderDetails.querySelector('[name="instructions"]').value;
    var name = builderDetails.querySelector('[name="level_name"]').value;
    var query = url.parse(window.location.href, true).query;
    onAttemptCallback(utils.extend({
      "instructions": instructions,
      "name": name
    }, query));
  });

  dialog.show({ backdrop: 'static' });
};

},{"./dom.js":7,"./feedback.js":8,"./templates/builder.html":23,"./utils.js":34,"url":48}],6:[function(require,module,exports){
var INFINITE_LOOP_TRAP = '  executionInfo.checkTimeout(); if (executionInfo.isTerminated()){return;}\n';

var LOOP_HIGHLIGHT = 'loopHighlight();\n';
var LOOP_HIGHLIGHT_RE =
    new RegExp(LOOP_HIGHLIGHT.replace(/\(.*\)/, '\\(.*\\)'), 'g');

/**
 * Returns javascript code to call a timeout check
 */
exports.loopTrap = function() {
  return INFINITE_LOOP_TRAP;
};

exports.loopHighlight = function (apiName, blockId) {
  var args = "'block_id_" + blockId + "'";
  if (blockId === undefined) {
    args = "%1";
  }
  return apiName + '.' + LOOP_HIGHLIGHT.replace('()', '(' + args + ')');
};

/**
 * Extract the user's code as raw JavaScript.
 * @param {string} code Generated code.
 * @return {string} The code without serial numbers and timeout checks.
 */
exports.strip = function(code) {
  return (code
    // Strip out serial numbers.
    .replace(/(,\s*)?'block_id_\d+'\)/g, ')')
    // Remove timeouts.
    .replace(INFINITE_LOOP_TRAP, '')
    // Strip out loop highlight
    .replace(LOOP_HIGHLIGHT_RE, '')
    // Strip out class namespaces.
    .replace(/(BlocklyApps|Maze|Turtle)\./g, '')
    // Strip out particular helper functions.
    .replace(/^function (colour_random)[\s\S]*?^}/gm, '')
    // Collapse consecutive blank lines.
    .replace(/\n\n+/gm, '\n\n')
    // Trim.
    .replace(/^\s+|\s+$/g, '')
  );
};

/**
 * Extract the user's code as raw JavaScript.
 */
exports.workspaceCode = function(blockly) {
  var code = blockly.Generator.workspaceToCode('JavaScript');
  return exports.strip(code);
};

/**
 * Evaluates a string of code parameterized with a dictionary.
 */
exports.evalWith = function(code, options) {
  var params = [];
  var args = [];
  for (var k in options) {
    params.push(k);
    args.push(options[k]);
  }
  params.push(code);
  var ctor = function() {
    return Function.apply(this, params);
  };
  ctor.prototype = Function.prototype;
  var fn = new ctor();
  return fn.apply(null, args);
};

/**
 * Returns a function based on a string of code parameterized with a dictionary.
 */
exports.functionFromCode = function(code, options) {
  var params = [];
  var args = [];
  for (var k in options) {
    params.push(k);
    args.push(options[k]);
  }
  params.push(code);
  var ctor = function() {
    return Function.apply(this, params);
  };
  ctor.prototype = Function.prototype;
  return new ctor();
};

},{}],7:[function(require,module,exports){
exports.addReadyListener = function(callback) {
  if (document.readyState === "complete") {
    setTimeout(callback, 1);
  } else {
    window.addEventListener('load', callback, false);
  }
};

exports.getText = function(node) {
  return node.innerText || node.textContent;
};

exports.setText = function(node, string) {
  if (node.innerText) {
    node.innerText = string;
  } else {
    node.textContent = string;
  }
};


var addEvent = function(element, eventName, handler) {
  element.addEventListener(eventName, handler, false);

  var isIE11Touch = window.navigator.pointerEnabled;
  var isIE10Touch = window.navigator.msPointerEnabled;
  var isStandardTouch = 'ontouchend' in document.documentElement;

  var key;
  if (isIE11Touch) {
    key = "ie11";
  } else if (isIE10Touch) {
    key = "ie10";
  } else if (isStandardTouch) {
    key = "standard";
  }
  if (key) {
    var touchEvent = TOUCH_MAP[eventName][key];
    element.addEventListener(touchEvent, function(e) {
      e.preventDefault();  // Stop mouse events.
      handler(e);
    }, false);
  }
};

exports.addMouseDownTouchEvent = function(element, handler) {
  addEvent(element, 'mousedown', handler);
};

exports.addClickTouchEvent = function(element, handler) {
  addEvent(element, 'click', handler);
};

// A map from standard touch events to various aliases.
var TOUCH_MAP = {
  //  Incomplete list, add as needed.
  click: {
    standard: 'touchend',
    ie10: 'mspointerup',
    ie11: 'pointerup'
  },
  mousedown: {
    standard: 'touchstart',
    ie10: 'mspointerdown',
    ie11: 'pointerdown'
  }
};

exports.isMobile = function() {
  var reg = /Mobile|iP(hone|od|ad)|Android|BlackBerry|IEMobile/;
  return reg.test(window.navigator.userAgent);
};

},{}],8:[function(require,module,exports){
var trophy = require('./templates/trophy.html');
var utils = require('./utils');
var readonly = require('./templates/readonly.html');
var codegen = require('./codegen');
var msg = require('../locale/pt_pt/common');
var dom = require('./dom');

exports.displayFeedback = function(options) {
  options.level = options.level || {};
  options.numTrophies = numTrophiesEarned(options);

  var canContinue = exports.canContinueToNextLevel(options.feedbackType);
  var displayShowCode = BlocklyApps.enableShowCode && canContinue;
  var feedback = document.createElement('div');
  var feedbackMessage = getFeedbackMessage(options);
  var sharingDiv = (canContinue && options.showingSharing) ? exports.createSharingDiv(options) : null;
  var showCode = displayShowCode ? getShowCodeElement(options) : null;
  var feedbackBlocks = new FeedbackBlocks(options);

  if (feedbackMessage) {
    feedback.appendChild(feedbackMessage);
  }
  if (options.numTrophies) {
    var trophies = getTrophiesElement(options);
    feedback.appendChild(trophies);
  }
  if (feedbackBlocks.div) {
    feedback.appendChild(feedbackBlocks.div);
  }
  if (sharingDiv) {
    feedback.appendChild(sharingDiv);
  }
  if (options.showingSharing) {
    var shareCodeSpacer = document.createElement('div');
    shareCodeSpacer.className = "share-code-spacer";
    feedback.appendChild(shareCodeSpacer);
  }
  if (showCode) {
    feedback.appendChild(showCode);
  }
  if (options.level.is_k1) {
    feedback.className += " k1";
  }

  feedback.appendChild(getFeedbackButtons(
    options.feedbackType, options.level.showPreviousLevelButton));

  var againButton = feedback.querySelector('#again-button');
  var previousLevelButton = feedback.querySelector('#back-button');
  var continueButton = feedback.querySelector('#continue-button');

  var onlyContinue = continueButton && !againButton && !previousLevelButton;

  var onHidden = onlyContinue ? options.onContinue : null;
  var icon = canContinue ? BlocklyApps.WIN_ICON : BlocklyApps.FAILURE_ICON;
  var defaultBtnSelector = onlyContinue ? '#continue-button' : '#again-button';

  var feedbackDialog = exports.createModalDialogWithIcon({
    Dialog: options.Dialog,
    contentDiv: feedback,
    icon: icon,
    defaultBtnSelector: defaultBtnSelector,
    onHidden: onHidden,
    id: 'feedback-dialog'
  });

  // Update the background color if it is set to be in special design.
  if (options.response && options.response.design &&
      isFeedbackMessageCustomized(options)) {
    if (options.response.design == "white_background") {
      document.getElementById('feedback-dialog')
          .className += " white-background";
      document.getElementById('feedback-content')
          .className += " light-yellow-background";
    }
  }

  if (againButton) {
    dom.addClickTouchEvent(againButton, function() {
      feedbackDialog.hide();
    });
  }

  if (previousLevelButton) {
    dom.addClickTouchEvent(previousLevelButton, function() {
      feedbackDialog.hide();
      options.backToPreviousLevel();
    });
  }

  if (continueButton) {
    dom.addClickTouchEvent(continueButton, function() {
      feedbackDialog.hide();
      // onContinue will fire already if there was only a continue button
      if (!onlyContinue) {
        options.onContinue();
      }
    });
  }

  // set up the Save To Gallery button if necessary
  var saveToGalleryButton = feedback.querySelector('#save-to-gallery-button');
  if (saveToGalleryButton && options.response && options.response.save_to_gallery_url) {
    dom.addClickTouchEvent(saveToGalleryButton, function() {
      $.post(options.response.save_to_gallery_url,
             function() { $('#save-to-gallery-button').prop('disabled', true).text("Saved!"); });
    });
  }

  feedbackDialog.show({
    backdrop: (options.app === 'flappy' ? 'static' : true)
  });

  if (feedbackBlocks.div) {
    feedbackBlocks.show();
  }
};

/**
 * Counts the number of blocks used.  Blocks are only counted if they are
 * not disabled, are deletable.
 * @return {number} Number of blocks used.
 */
exports.getNumBlocksUsed = function() {
  var i;
  if (BlocklyApps.editCode) {
    var codeLines = 0;
    // quick and dirty method to count non-blank lines that don't start with //
    var lines = getGeneratedCodeString().split("\n");
    for (i = 0; i < lines.length; i++) {
      if ((lines[i].length > 1) && (lines[i][0] != '/' || lines[i][1] != '/')) {
        codeLines++;
      }
    }
    return codeLines;
  }
  return getUserBlocks().length;
};

/**
 * Counts the number of given blocks.  Blocks are only counted if they are
 * disabled or are deletable.
 * @return {number} Number of given blocks.
 */
exports.getNumGivenBlocks = function() {
  var i;
  if (BlocklyApps.editCode) {
    // When we are in edit mode, we can no longer tell which lines are given,
    // and which lines are edited. Returning zero here.
    return 0;
  }
  return getGivenBlocks().length;
};

/**
 * Counts the total number of blocks. Blocks are only counted if they are
 * not disabled.
 * @return {number} Total number of blocks.
 */
exports.getNumEnabledBlocks = function() {
  var i;
  if (BlocklyApps.editCode) {
    var codeLines = 0;
    // quick and dirty method to count non-blank lines that don't start with //
    var lines = getGeneratedCodeString().split("\n");
    for (i = 0; i < lines.length; i++) {
      if ((lines[i].length > 1) && (lines[i][0] != '/' || lines[i][1] != '/')) {
        codeLines++;
      }
    }
    return codeLines;
  }
  return getEnabledBlocks().length;
};

var getFeedbackButtons = function(feedbackType, showPreviousLevelButton) {
  var buttons = document.createElement('div');
  buttons.id = 'feedbackButtons';
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      previousLevel:
        !exports.canContinueToNextLevel(feedbackType) &&
        showPreviousLevelButton,
      tryAgain: feedbackType !== BlocklyApps.TestResults.ALL_PASS,
      nextLevel: exports.canContinueToNextLevel(feedbackType)
    }
  });

  return buttons;
};

var getFeedbackMessage = function(options) {
  var feedback = document.createElement('p');
  feedback.className = 'congrats';
  var message;
  switch (options.feedbackType) {
    case BlocklyApps.TestResults.EMPTY_BLOCK_FAIL:
      message = msg.emptyBlocksErrorMsg();
      break;
    case BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL:
      message = options.level.tooFewBlocksMsg || msg.tooFewBlocksMsg();
      break;
    case BlocklyApps.TestResults.LEVEL_INCOMPLETE_FAIL:
      message = options.level.levelIncompleteError ||
          msg.levelIncompleteError();
      break;
    case BlocklyApps.TestResults.EXTRA_TOP_BLOCKS_FAIL:
      message = msg.extraTopBlocks();
      break;
    // For completing level, user gets at least one star.
    case BlocklyApps.TestResults.OTHER_1_STAR_FAIL:
      message = options.level.other1StarError || options.message;
      break;
    // Two stars for using too many blocks.
    case BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL:
      message = msg.numBlocksNeeded({
        numBlocks: BlocklyApps.IDEAL_BLOCK_NUM,
        puzzleNumber: options.level.puzzle_number || 0
      });
      break;
    case BlocklyApps.TestResults.OTHER_2_STAR_FAIL:
      message = msg.tooMuchWork();
      break;
    case BlocklyApps.TestResults.FLAPPY_SPECIFIC_FAIL:
      message = msg.flappySpecificFail();
      break;
    case BlocklyApps.TestResults.EDIT_BLOCKS:
      message = options.level.edit_blocks_success;
      break;
    case BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED:
      /* fallthrough */
    case BlocklyApps.TestResults.MISSING_BLOCK_FINISHED:
      message = msg.missingBlocksErrorMsg();
      break;
    case BlocklyApps.TestResults.ALL_PASS:
      var finalLevel = (options.response &&
          (options.response.message == "no more levels"));
      var stageCompleted = null;
      if (options.response && options.response.stage_changing) {
        stageCompleted = options.response.stage_changing.previous.name;
      }
      var msgParams = {
        numTrophies: options.numTrophies,
        stageNumber: 0, // TODO: remove once localized strings have been fixed
        stageName: stageCompleted,
        puzzleNumber: options.level.puzzle_number || 0
      };
      if (options.numTrophies > 0) {
        message = finalLevel ? msg.finalStageTrophies(msgParams) :
                               stageCompleted ?
                                  msg.nextStageTrophies(msgParams) :
                                  msg.nextLevelTrophies(msgParams);
      } else {
        message = finalLevel ? msg.finalStage(msgParams) :
                               stageCompleted ?
                                   msg.nextStage(msgParams) :
                                   msg.nextLevel(msgParams);
      }
      break;
    // Free plays
    case BlocklyApps.TestResults.FREE_PLAY:
      message = options.appStrings.reinfFeedbackMsg;
      break;
  }
  // Database hint overwrites the default hint.
  if (options.response && options.response.hint) {
    message = options.response.hint;
  }
  dom.setText(feedback, message);

  // Update the feedback box design, if the hint message is customized.
   if (options.response && options.response.design &&
       isFeedbackMessageCustomized(options)) {
    // Setup a new div
    var feedbackDiv = document.createElement('div');
    feedbackDiv.className = 'feedback-callout';
    feedbackDiv.id = 'feedback-content';

    // Insert an image
    var imageDiv = document.createElement('img');
    imageDiv.className = "hint-image";
    imageDiv.src = BlocklyApps.assetUrl(
      'media/lightbulb_for_' + options.response.design + '.png');
    feedbackDiv.appendChild(imageDiv);
    // Add new text
    var hintHeader = document.createElement('p');
    dom.setText(hintHeader, msg.hintHeader());
    feedbackDiv.appendChild(hintHeader);
    hintHeader.className = 'hint-header';
    // Append the original text
    feedbackDiv.appendChild(feedback);
    return feedbackDiv;
  }
  return feedback;
};

var isFeedbackMessageCustomized = function(options) {
  return options.response.hint ||
      (options.feedbackType == BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL &&
       options.level.tooFewBlocksMsg) ||
      (options.feedbackType == BlocklyApps.TestResults.LEVEL_INCOMPLETE_FAIL &&
       options.level.levelIncompleteError) ||
      (options.feedbackType == BlocklyApps.TestResults.OTHER_1_STAR_FAIL &&
       options.level.other1StarError);
};

exports.createSharingDiv = function(options) {
  if (!options.response || !options.response.level_source) {
    // don't even try if our caller didn't give us something that can be shared
    // options.response.level_source is the url that we are sharing
    return null;
  }

  // set up the twitter share url
  var twitterUrl = "https://twitter.com/intent/tweet?url=" +
                   options.response.level_source;

  if (options.twitter && options.twitter.text !== undefined) {
    twitterUrl += "&text=" + encodeURI(options.twitter.text);
  }
  if (options.twitter  && options.twitter.hashtag !== undefined) {
    twitterUrl += "&button_hashtag=" + options.twitter.hashtag;
  }
  options.twitterUrl = twitterUrl;

  // set up the facebook share url
  var facebookUrl = "https://www.facebook.com/sharer/sharer.php?u=" +
                    options.response.level_source;
  options.facebookUrl = facebookUrl;

  // use a generic image for the level if a feedback image has not been supplied.
  if (options.level && options.level.instructionImageUrl && !options.feedbackImage) {
    options.feedbackImage = options.level.instructionImageUrl;
  }

  var sharingDiv = document.createElement('div');
  sharingDiv.setAttribute('style', 'display:inline-block');
  sharingDiv.innerHTML = require('./templates/sharing.html')({
    options: options
  });

  var sharingInput = sharingDiv.querySelector('#sharing-input');
  if (sharingInput) {
    dom.addClickTouchEvent(sharingInput, function() {
      sharingInput.focus();
      sharingInput.select();
    });
  }

  return sharingDiv;
};


var numTrophiesEarned = function(options) {
  if (options.response && options.response.trophy_updates) {
    return options.response.trophy_updates.length;
  } else {
    return 0;
  }
};

var getTrophiesElement = function(options) {
  var html = "";
  for (var i = 0; i < options.numTrophies; i++) {
    html += trophy({
      img_url: options.response.trophy_updates[i][2],
      concept_name: options.response.trophy_updates[i][0]
    });
  }
  var trophies = document.createElement('div');
  trophies.innerHTML = html;
  return trophies;
};

var getShowCodeElement = function(options) {
  var showCodeDiv = document.createElement('div');
  showCodeDiv.setAttribute('id', 'show-code');

  var numLinesWritten = exports.getNumBlocksUsed();
  var shouldShowTotalLines =
    (options.response &&
      options.response.total_lines &&
      (options.response.total_lines !== numLinesWritten));
  var totalNumLinesWritten = shouldShowTotalLines ? options.response.total_lines : 0;

  showCodeDiv.innerHTML = require('./templates/showCode.html')({
    numLinesWritten: numLinesWritten,
    totalNumLinesWritten: totalNumLinesWritten
  });

  var showCodeButton = showCodeDiv.querySelector('#show-code-button');
  showCodeButton.addEventListener('click', function () {
    showCodeDiv.appendChild(getGeneratedCodeElement());
    showCodeButton.style.display = 'none';
  });

  return showCodeDiv;
};

/**
 * Determines whether the user can proceed to the next level, based on the level feedback
 * @param {number} feedbackType A constant property of BlocklyApps.TestResults,
 *     typically produced by BlocklyApps.getTestResults().
 */
exports.canContinueToNextLevel = function(feedbackType) {
  return (feedbackType === BlocklyApps.TestResults.ALL_PASS ||
    feedbackType === BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL ||
    feedbackType ===  BlocklyApps.TestResults.OTHER_2_STAR_FAIL ||
    feedbackType ===  BlocklyApps.TestResults.FREE_PLAY);
};

/**
 * Retrieve a string containing the user's generated Javascript code.
 */
var getGeneratedCodeString = function() {
  if (BlocklyApps.editCode) {
    var codeTextbox = document.getElementById('codeTextbox');
    return dom.getText(codeTextbox);
  }
  else {
    return codegen.workspaceCode(Blockly);
  }
};

var FeedbackBlocks = function(options) {
  var missingBlocks = getMissingRequiredBlocks();
  if (missingBlocks.length === 0) {
    return;
  }
  if ((options.response && options.response.hint) ||
      (options.feedbackType !==
       BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED &&
       options.feedbackType !==
       BlocklyApps.TestResults.MISSING_BLOCK_FINISHED)) {
    return;
  }

  this.div = document.createElement('div');
  this.html = readonly({
    app: options.app,
    assetUrl: BlocklyApps.assetUrl,
    options: {
      readonly: true,
      locale: BlocklyApps.LOCALE,
      localeDirection: BlocklyApps.localeDirection(),
      baseUrl: BlocklyApps.BASE_URL,
      cacheBust: BlocklyApps.CACHE_BUST,
      skinId: options.skin,
      level: options.level,
      blocks: generateXMLForBlocks(missingBlocks)
    }
  });
  this.iframe = document.createElement('iframe');
  this.iframe.setAttribute('id', 'feedbackBlocks');
  this.div.appendChild(this.iframe);
};

FeedbackBlocks.prototype.show = function() {
  var iframe = document.getElementById('feedbackBlocks');
  if (iframe) {
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(this.html);
    doc.close();
  }
};

var getGeneratedCodeElement = function() {
  var codeInfoMsgParams = {
    berkeleyLink: "<a href='http://bjc.berkeley.edu/' target='_blank'>Berkeley</a>",
    harvardLink: "<a href='https://cs50.harvard.edu/' target='_blank'>Harvard</a>"
  };

  var infoMessage = BlocklyApps.editCode ?  "" : msg.generatedCodeInfo(codeInfoMsgParams);
  var code = getGeneratedCodeString();

  var codeDiv = document.createElement('div');
  codeDiv.innerHTML = require('./templates/code.html')({
    message: infoMessage,
    code: code
  });

  return codeDiv;
};

exports.showGeneratedCode = function(Dialog) {
  var codeDiv = getGeneratedCodeElement();

  var buttons = document.createElement('div');
  buttons.innerHTML = require('./templates/buttons.html')({
    data: {
      ok: true
    }
  });
  codeDiv.appendChild(buttons);

  var dialog = exports.createModalDialogWithIcon({
      Dialog: Dialog,
      contentDiv: codeDiv,
      icon: BlocklyApps.ICON,
      defaultBtnSelector: '#ok-button'
      });

  var okayButton = buttons.querySelector('#ok-button');
  if (okayButton) {
    dom.addClickTouchEvent(okayButton, function() {
      dialog.hide();
    });
  }

  dialog.show();
};

/**
 * Check user's code for empty top-level blocks e.g. 'repeat'.
 * @return {boolean} true if block is empty (no blocks are nested inside).
 */
exports.hasEmptyTopLevelBlocks = function() {
  var code = codegen.workspaceCode(Blockly);
  return (/\{\s*\}/).test(code);
};

/**
 * Check whether the user code has all the blocks required for the level.
 * @return {boolean} true if all blocks are present, false otherwise.
 */
var hasAllRequiredBlocks = function() {
  return getMissingRequiredBlocks().length === 0;
};

/**
 * Get blocks that the user intends in the program, namely any that
 * are not disabled and can be deleted.
 * @return {Array<Object>} The blocks.
 */
var getUserBlocks = function() {
  var allBlocks = Blockly.mainWorkspace.getAllBlocks();
  var blocks = allBlocks.filter(function(block) {
    return !block.disabled && block.isDeletable();
  });
  return blocks;
};

/**
 * Get blocks that were given to the user in the program, namely any that
 * are disabled or cannot be deleted.
 * @return {Array<Object>} The blocks.
 */
var getGivenBlocks = function() {
  var allBlocks = Blockly.mainWorkspace.getAllBlocks();
  var blocks = allBlocks.filter(function(block) {
    return block.disabled || !block.isDeletable();
  });
  return blocks;
};

/**
 * Get enabled blocks in the program, namely any that are not disabled.
 * @return {Array<Object>} The blocks.
 */
var getEnabledBlocks = function() {
  var allBlocks = Blockly.mainWorkspace.getAllBlocks();
  var blocks = allBlocks.filter(function(block) {
    return !block.disabled;
  });
  return blocks;
};

/**
 * Check to see if the user's code contains the required blocks for a level.
 * This never returns more than BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG.
 * @return {!Array} array of array of strings where each array of strings is
 * a set of blocks that at least one of them should be used. Each block is
 * represented as the prefix of an id in the corresponding template.soy.
 */
var getMissingRequiredBlocks = function () {
  var missingBlocks = [];
  var code = null;  // JavaScript code, which is initalized lazily.
  if (BlocklyApps.REQUIRED_BLOCKS && BlocklyApps.REQUIRED_BLOCKS.length) {
    var userBlocks = getUserBlocks();
    // For each list of required blocks
    // Keep track of the number of the missing block lists. It should not be
    // bigger than BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG
    var missingBlockNum = 0;
    for (var i = 0;
         i < BlocklyApps.REQUIRED_BLOCKS.length &&
             missingBlockNum < BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG;
         i++) {
      var requiredBlock = BlocklyApps.REQUIRED_BLOCKS[i];
      // For each of the test
      // If at least one of the tests succeeded, we consider the required block
      // is used
      var usedRequiredBlock = false;
      for (var testId = 0; testId < requiredBlock.length; testId++) {
        var test = requiredBlock[testId].test;
        if (typeof test === 'string') {
          code = code || Blockly.Generator.workspaceToCode('JavaScript');
          if (code.indexOf(test) !== -1) {
            // Succeeded, moving to the next list of tests
            usedRequiredBlock = true;
            break;
          }
        } else if (typeof test === 'function') {
          if (userBlocks.some(test)) {
            // Succeeded, moving to the next list of tests
            usedRequiredBlock = true;
            break;
          }
        } else {
          throw new Error('Bad test: ' + test);
        }
      }
      if (!usedRequiredBlock) {
        missingBlockNum++;
        missingBlocks = missingBlocks.concat(BlocklyApps.REQUIRED_BLOCKS[i]);
      }
    }
  }
  return missingBlocks;
};

/**
 * Runs the tests and returns results.
 * @return {number} The appropriate property of BlocklyApps.TestResults.
 */
exports.getTestResults = function() {
  if (BlocklyApps.CHECK_FOR_EMPTY_BLOCKS && exports.hasEmptyTopLevelBlocks()) {
    return BlocklyApps.TestResults.EMPTY_BLOCK_FAIL;
  }
  if (BlocklyApps.numRequiredTopBlocks &&
    BlocklyApps.numRequiredTopBlocks != Blockly.mainWorkspace.getTopBlocks().length) {
    return BlocklyApps.TestResults.EXTRA_TOP_BLOCKS_FAIL;
  }
  if (!hasAllRequiredBlocks()) {
    if (BlocklyApps.levelComplete) {
      return BlocklyApps.TestResults.MISSING_BLOCK_FINISHED;
    } else {
      return BlocklyApps.TestResults.MISSING_BLOCK_UNFINISHED;
    }
  }
  var numEnabledBlocks = exports.getNumEnabledBlocks();
  if (!BlocklyApps.levelComplete) {
    if (BlocklyApps.IDEAL_BLOCK_NUM &&
        numEnabledBlocks < BlocklyApps.IDEAL_BLOCK_NUM) {
      return BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL;
    }
    return BlocklyApps.TestResults.LEVEL_INCOMPLETE_FAIL;
  }
  if (BlocklyApps.IDEAL_BLOCK_NUM &&
      numEnabledBlocks > BlocklyApps.IDEAL_BLOCK_NUM) {
    return BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL;
  } else {
    return BlocklyApps.TestResults.ALL_PASS;
  }
};

var Keycodes = {
  ENTER: 13,
  SPACE: 32
};

exports.createModalDialogWithIcon = function(options) {
  var imageDiv = document.createElement('img');
  imageDiv.className = "modal-image";
  imageDiv.src = options.icon;

  var modalBody = document.createElement('div');
  modalBody.appendChild(imageDiv);
  options.contentDiv.className += ' modal-content';
  modalBody.appendChild(options.contentDiv);

  var btn = options.contentDiv.querySelector(options.defaultBtnSelector);
  var keydownHandler = function(e) {
    if (e.keyCode == Keycodes.ENTER || e.keyCode == Keycodes.SPACE) {
      Blockly.fireUiEvent(btn, 'click');
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return new options.Dialog({
    body: modalBody,
    onHidden: options.onHidden,
    onKeydown: btn ? keydownHandler : undefined,
    id: options.id
  });
};

/**
 * Creates the XML for blocks to be displayed in a read-only frame.
 * @param {Array} blocks An array of blocks to display (with optional args).
 * @return {string} The generated string of XML.
 */
var generateXMLForBlocks = function(blocks) {
  var blockXMLStrings = [];
  var blockX = 10;  // Prevent left output plugs from being cut off.
  var blockY = 0;
  var blockXPadding = 200;
  var blockYPadding = 120;
  var blocksPerLine = 2;
  var k, name;
  for (var i = 0; i < blocks.length; i++) {
    var block = blocks[i];
    if (block.blockDisplayXML) {
      blockXMLStrings.push(block.blockDisplayXML);
      continue;
    }
    blockXMLStrings.push('<block', ' type="', block.type, '" x="',
                        blockX.toString(), '" y="', blockY, '">');
    if (block.titles) {
      var titleNames = Object.keys(block.titles);
      for (k = 0; k < titleNames.length; k++) {
        name = titleNames[k];
        blockXMLStrings.push('<title name="', name, '">',
                            block.titles[name], '</title>');
      }
    }
    if (block.values) {
      var valueNames = Object.keys(block.values);
      for (k = 0; k < valueNames.length; k++) {
        name = valueNames[k];
        blockXMLStrings.push('<value name="', name, '">',
                            block.values[name], '</value>');
      }
    }
    if (block.extra) {
      blockXMLStrings.push(block.extra);
    }
    blockXMLStrings.push('</block>');
    if ((i + 1) % blocksPerLine === 0) {
      blockY += blockYPadding;
      blockX = 0;
    } else {
      blockX += blockXPadding;
    }
  }
  return blockXMLStrings.join('');
};


},{"../locale/pt_pt/common":36,"./codegen":6,"./dom":7,"./templates/buttons.html":24,"./templates/code.html":25,"./templates/readonly.html":30,"./templates/sharing.html":31,"./templates/showCode.html":32,"./templates/trophy.html":33,"./utils":34}],9:[function(require,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash include="debounce,reject,map,value" --output build/js/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [];

  /** Used internally to indicate various things */
  var indicatorObject = {};

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to fix the JScript [[DontEnum]] bug */
  var shadowedProps = [
    'constructor', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
    'toLocaleString', 'toString', 'valueOf'
  ];

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      errorClass = '[object Error]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used as the data object for `iteratorTemplate` */
  var iteratorData = {
    'args': '',
    'array': null,
    'bottom': '',
    'firstArg': '',
    'init': '',
    'keys': null,
    'loop': '',
    'shadowedProps': null,
    'support': null,
    'top': '',
    'useHas': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Checks if `value` is a DOM node in IE < 9.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a DOM node, else `false`.
   */
  function isNode(value) {
    // IE < 9 presents DOM nodes as `Object` objects except they have `toString`
    // methods that are `typeof` "string" and still can coerce nodes to strings
    return typeof value.toString != 'function' && typeof (value + '') == 'string';
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Used for `Array` method references.
   *
   * Normally `Array.prototype` would suffice, however, using an array literal
   * avoids issues in Narwhal.
   */
  var arrayRef = [];

  /** Used for native method references */
  var errorProto = Error.prototype,
      objectProto = Object.prototype,
      stringProto = String.prototype;

  /** Used to resolve the internal [[Class]] of values */
  var toString = objectProto.toString;

  /** Used to detect if a method is native */
  var reNative = RegExp('^' +
    String(toString)
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/toString| for [^\]]+/g, '.*?') + '$'
  );

  /** Native method shortcuts */
  var fnToString = Function.prototype.toString,
      hasOwnProperty = objectProto.hasOwnProperty,
      push = arrayRef.push,
      propertyIsEnumerable = objectProto.propertyIsEnumerable,
      unshift = arrayRef.unshift;

  /** Used to set meta data on functions */
  var defineProperty = (function() {
    // IE 8 only accepts DOM elements
    try {
      var o = {},
          func = isNative(func = Object.defineProperty) && func,
          result = func(o, o, o) && func;
    } catch(e) { }
    return result;
  }());

  /* Native method shortcuts for methods with the same name as other `lodash` methods */
  var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
      nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
      nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
      nativeMax = Math.max;

  /** Used to avoid iterating non-enumerable properties in IE < 9 */
  var nonEnumProps = {};
  nonEnumProps[arrayClass] = nonEnumProps[dateClass] = nonEnumProps[numberClass] = { 'constructor': true, 'toLocaleString': true, 'toString': true, 'valueOf': true };
  nonEnumProps[boolClass] = nonEnumProps[stringClass] = { 'constructor': true, 'toString': true, 'valueOf': true };
  nonEnumProps[errorClass] = nonEnumProps[funcClass] = nonEnumProps[regexpClass] = { 'constructor': true, 'toString': true };
  nonEnumProps[objectClass] = { 'constructor': true };

  (function() {
    var length = shadowedProps.length;
    while (length--) {
      var key = shadowedProps[length];
      for (var className in nonEnumProps) {
        if (hasOwnProperty.call(nonEnumProps, className) && !hasOwnProperty.call(nonEnumProps[className], key)) {
          nonEnumProps[className][key] = false;
        }
      }
    }
  }());

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a `lodash` object which wraps the given value to enable intuitive
   * method chaining.
   *
   * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
   * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
   * and `unshift`
   *
   * Chaining is supported in custom builds as long as the `value` method is
   * implicitly or explicitly included in the build.
   *
   * The chainable wrapper functions are:
   * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
   * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
   * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
   * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
   * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
   * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
   * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
   * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
   * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
   * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
   * and `zip`
   *
   * The non-chainable wrapper functions are:
   * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
   * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
   * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
   * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
   * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
   * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
   * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
   * `template`, `unescape`, `uniqueId`, and `value`
   *
   * The wrapper functions `first` and `last` return wrapped values when `n` is
   * provided, otherwise they return unwrapped values.
   *
   * Explicit chaining can be enabled by using the `_.chain` method.
   *
   * @name _
   * @constructor
   * @category Chaining
   * @param {*} value The value to wrap in a `lodash` instance.
   * @returns {Object} Returns a `lodash` instance.
   * @example
   *
   * var wrapped = _([1, 2, 3]);
   *
   * // returns an unwrapped value
   * wrapped.reduce(function(sum, num) {
   *   return sum + num;
   * });
   * // => 6
   *
   * // returns a wrapped value
   * var squares = wrapped.map(function(num) {
   *   return num * num;
   * });
   *
   * _.isArray(squares);
   * // => false
   *
   * _.isArray(squares.value());
   * // => true
   */
  function lodash(value) {
    // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
    return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
     ? value
     : new lodashWrapper(value);
  }

  /**
   * A fast path for creating `lodash` wrapper objects.
   *
   * @private
   * @param {*} value The value to wrap in a `lodash` instance.
   * @param {boolean} chainAll A flag to enable chaining for all methods
   * @returns {Object} Returns a `lodash` instance.
   */
  function lodashWrapper(value, chainAll) {
    this.__chain__ = !!chainAll;
    this.__wrapped__ = value;
  }
  // ensure `new lodashWrapper` is an instance of `lodash`
  lodashWrapper.prototype = lodash.prototype;

  /**
   * An object used to flag environments features.
   *
   * @static
   * @memberOf _
   * @type Object
   */
  var support = lodash.support = {};

  (function() {
    var ctor = function() { this.x = 1; },
        object = { '0': 1, 'length': 1 },
        props = [];

    ctor.prototype = { 'valueOf': 1, 'y': 1 };
    for (var key in new ctor) { props.push(key); }
    for (key in arguments) { }

    /**
     * Detect if an `arguments` object's [[Class]] is resolvable (all but Firefox < 4, IE < 9).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.argsClass = toString.call(arguments) == argsClass;

    /**
     * Detect if `arguments` objects are `Object` objects (all but Narwhal and Opera < 10.5).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.argsObject = arguments.constructor == Object && !(arguments instanceof Array);

    /**
     * Detect if `name` or `message` properties of `Error.prototype` are
     * enumerable by default. (IE < 9, Safari < 5.1)
     *
     * @memberOf _.support
     * @type boolean
     */
    support.enumErrorProps = propertyIsEnumerable.call(errorProto, 'message') || propertyIsEnumerable.call(errorProto, 'name');

    /**
     * Detect if `prototype` properties are enumerable by default.
     *
     * Firefox < 3.6, Opera > 9.50 - Opera < 11.60, and Safari < 5.1
     * (if the prototype or a property on the prototype has been set)
     * incorrectly sets a function's `prototype` property [[Enumerable]]
     * value to `true`.
     *
     * @memberOf _.support
     * @type boolean
     */
    support.enumPrototypes = propertyIsEnumerable.call(ctor, 'prototype');

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(root.WinRTError) && reThis.test(function() { return this; });

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * Detect if `arguments` object indexes are non-enumerable
     * (Firefox < 4, IE < 9, PhantomJS, Safari < 5.1).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.nonEnumArgs = key != 0;

    /**
     * Detect if properties shadowing those on `Object.prototype` are non-enumerable.
     *
     * In IE < 9 an objects own properties, shadowing non-enumerable ones, are
     * made non-enumerable as well (a.k.a the JScript [[DontEnum]] bug).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.nonEnumShadows = !/valueOf/.test(props);

    /**
     * Detect if `Array#shift` and `Array#splice` augment array-like objects correctly.
     *
     * Firefox < 10, IE compatibility mode, and IE < 9 have buggy Array `shift()`
     * and `splice()` functions that fail to remove the last element, `value[0]`,
     * of array-like objects even though the `length` property is set to `0`.
     * The `shift()` method is buggy in IE 8 compatibility mode, while `splice()`
     * is buggy regardless of mode in IE < 9 and buggy in compatibility mode in IE 9.
     *
     * @memberOf _.support
     * @type boolean
     */
    support.spliceObjects = (arrayRef.splice.call(object, 0, 1), !object[0]);

    /**
     * Detect lack of support for accessing string characters by index.
     *
     * IE < 8 can't access characters by index and IE 8 can only access
     * characters by index on string literals.
     *
     * @memberOf _.support
     * @type boolean
     */
    support.unindexedChars = ('x'[0] + Object('x')[0]) != 'xx';
  }(1));

  /*--------------------------------------------------------------------------*/

  /**
   * The template used to create iterator functions.
   *
   * @private
   * @param {Object} data The data object used to populate the text.
   * @returns {string} Returns the interpolated text.
   */
  var iteratorTemplate = function(obj) {

    var __p = 'var index, iterable = ' +
    (obj.firstArg) +
    ', result = ' +
    (obj.init) +
    ';\nif (!iterable) return result;\n' +
    (obj.top) +
    ';';
     if (obj.array) {
    __p += '\nvar length = iterable.length; index = -1;\nif (' +
    (obj.array) +
    ') {  ';
     if (support.unindexedChars) {
    __p += '\n  if (isString(iterable)) {\n    iterable = iterable.split(\'\')\n  }  ';
     }
    __p += '\n  while (++index < length) {\n    ' +
    (obj.loop) +
    ';\n  }\n}\nelse {  ';
     } else if (support.nonEnumArgs) {
    __p += '\n  var length = iterable.length; index = -1;\n  if (length && isArguments(iterable)) {\n    while (++index < length) {\n      index += \'\';\n      ' +
    (obj.loop) +
    ';\n    }\n  } else {  ';
     }

     if (support.enumPrototypes) {
    __p += '\n  var skipProto = typeof iterable == \'function\';\n  ';
     }

     if (support.enumErrorProps) {
    __p += '\n  var skipErrorProps = iterable === errorProto || iterable instanceof Error;\n  ';
     }

        var conditions = [];    if (support.enumPrototypes) { conditions.push('!(skipProto && index == "prototype")'); }    if (support.enumErrorProps)  { conditions.push('!(skipErrorProps && (index == "message" || index == "name"))'); }

     if (obj.useHas && obj.keys) {
    __p += '\n  var ownIndex = -1,\n      ownProps = objectTypes[typeof iterable] && keys(iterable),\n      length = ownProps ? ownProps.length : 0;\n\n  while (++ownIndex < length) {\n    index = ownProps[ownIndex];\n';
        if (conditions.length) {
    __p += '    if (' +
    (conditions.join(' && ')) +
    ') {\n  ';
     }
    __p +=
    (obj.loop) +
    ';    ';
     if (conditions.length) {
    __p += '\n    }';
     }
    __p += '\n  }  ';
     } else {
    __p += '\n  for (index in iterable) {\n';
        if (obj.useHas) { conditions.push("hasOwnProperty.call(iterable, index)"); }    if (conditions.length) {
    __p += '    if (' +
    (conditions.join(' && ')) +
    ') {\n  ';
     }
    __p +=
    (obj.loop) +
    ';    ';
     if (conditions.length) {
    __p += '\n    }';
     }
    __p += '\n  }    ';
     if (support.nonEnumShadows) {
    __p += '\n\n  if (iterable !== objectProto) {\n    var ctor = iterable.constructor,\n        isProto = iterable === (ctor && ctor.prototype),\n        className = iterable === stringProto ? stringClass : iterable === errorProto ? errorClass : toString.call(iterable),\n        nonEnum = nonEnumProps[className];\n      ';
     for (k = 0; k < 7; k++) {
    __p += '\n    index = \'' +
    (obj.shadowedProps[k]) +
    '\';\n    if ((!(isProto && nonEnum[index]) && hasOwnProperty.call(iterable, index))';
            if (!obj.useHas) {
    __p += ' || (!nonEnum[index] && iterable[index] !== objectProto[index])';
     }
    __p += ') {\n      ' +
    (obj.loop) +
    ';\n    }      ';
     }
    __p += '\n  }    ';
     }

     }

     if (obj.array || support.nonEnumArgs) {
    __p += '\n}';
     }
    __p +=
    (obj.bottom) +
    ';\nreturn result';

    return __p
  };

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.bind` that creates the bound function and
   * sets its meta data.
   *
   * @private
   * @param {Array} bindData The bind data array.
   * @returns {Function} Returns the new bound function.
   */
  function baseBind(bindData) {
    var func = bindData[0],
        partialArgs = bindData[2],
        thisArg = bindData[4];

    function bound() {
      // `Function#bind` spec
      // http://es5.github.io/#x15.3.4.5
      if (partialArgs) {
        // avoid `arguments` object deoptimizations by using `slice` instead
        // of `Array.prototype.slice.call` and not assigning `arguments` to a
        // variable as a ternary expression
        var args = slice(partialArgs);
        push.apply(args, arguments);
      }
      // mimic the constructor's `return` behavior
      // http://es5.github.io/#x13.2.2
      if (this instanceof bound) {
        // ensure `new bound` is an instance of `func`
        var thisBinding = baseCreate(func.prototype),
            result = func.apply(thisBinding, args || arguments);
        return isObject(result) ? result : thisBinding;
      }
      return func.apply(thisArg, args || arguments);
    }
    setBindData(bound, bindData);
    return bound;
  }

  /**
   * The base implementation of `_.create` without support for assigning
   * properties to the created object.
   *
   * @private
   * @param {Object} prototype The object to inherit from.
   * @returns {Object} Returns the new object.
   */
  function baseCreate(prototype, properties) {
    return isObject(prototype) ? nativeCreate(prototype) : {};
  }
  // fallback for browsers without `Object.create`
  if (!nativeCreate) {
    baseCreate = (function() {
      function Object() {}
      return function(prototype) {
        if (isObject(prototype)) {
          Object.prototype = prototype;
          var result = new Object;
          Object.prototype = null;
        }
        return result || root.Object();
      };
    }());
  }

  /**
   * The base implementation of `_.createCallback` without support for creating
   * "_.pluck" or "_.where" style callbacks.
   *
   * @private
   * @param {*} [func=identity] The value to convert to a callback.
   * @param {*} [thisArg] The `this` binding of the created callback.
   * @param {number} [argCount] The number of arguments the callback accepts.
   * @returns {Function} Returns a callback function.
   */
  function baseCreateCallback(func, thisArg, argCount) {
    if (typeof func != 'function') {
      return identity;
    }
    // exit early for no `thisArg` or already bound by `Function#bind`
    if (typeof thisArg == 'undefined' || !('prototype' in func)) {
      return func;
    }
    var bindData = func.__bindData__;
    if (typeof bindData == 'undefined') {
      if (support.funcNames) {
        bindData = !func.name;
      }
      bindData = bindData || !support.funcDecomp;
      if (!bindData) {
        var source = fnToString.call(func);
        if (!support.funcNames) {
          bindData = !reFuncName.test(source);
        }
        if (!bindData) {
          // checks if `func` references the `this` keyword and stores the result
          bindData = reThis.test(source);
          setBindData(func, bindData);
        }
      }
    }
    // exit early if there are no `this` references or `func` is bound
    if (bindData === false || (bindData !== true && bindData[1] & 1)) {
      return func;
    }
    switch (argCount) {
      case 1: return function(value) {
        return func.call(thisArg, value);
      };
      case 2: return function(a, b) {
        return func.call(thisArg, a, b);
      };
      case 3: return function(value, index, collection) {
        return func.call(thisArg, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(thisArg, accumulator, value, index, collection);
      };
    }
    return bind(func, thisArg);
  }

  /**
   * The base implementation of `createWrapper` that creates the wrapper and
   * sets its meta data.
   *
   * @private
   * @param {Array} bindData The bind data array.
   * @returns {Function} Returns the new function.
   */
  function baseCreateWrapper(bindData) {
    var func = bindData[0],
        bitmask = bindData[1],
        partialArgs = bindData[2],
        partialRightArgs = bindData[3],
        thisArg = bindData[4],
        arity = bindData[5];

    var isBind = bitmask & 1,
        isBindKey = bitmask & 2,
        isCurry = bitmask & 4,
        isCurryBound = bitmask & 8,
        key = func;

    function bound() {
      var thisBinding = isBind ? thisArg : this;
      if (partialArgs) {
        var args = slice(partialArgs);
        push.apply(args, arguments);
      }
      if (partialRightArgs || isCurry) {
        args || (args = slice(arguments));
        if (partialRightArgs) {
          push.apply(args, partialRightArgs);
        }
        if (isCurry && args.length < arity) {
          bitmask |= 16 & ~32;
          return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
        }
      }
      args || (args = arguments);
      if (isBindKey) {
        func = thisBinding[key];
      }
      if (this instanceof bound) {
        thisBinding = baseCreate(func.prototype);
        var result = func.apply(thisBinding, args);
        return isObject(result) ? result : thisBinding;
      }
      return func.apply(thisBinding, args);
    }
    setBindData(bound, bindData);
    return bound;
  }

  /**
   * The base implementation of `_.isEqual`, without support for `thisArg` binding,
   * that allows partial "_.where" style comparisons.
   *
   * @private
   * @param {*} a The value to compare.
   * @param {*} b The other value to compare.
   * @param {Function} [callback] The function to customize comparing values.
   * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
   * @param {Array} [stackA=[]] Tracks traversed `a` objects.
   * @param {Array} [stackB=[]] Tracks traversed `b` objects.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   */
  function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
    // used to indicate that when comparing objects, `a` has at least the properties of `b`
    if (callback) {
      var result = callback(a, b);
      if (typeof result != 'undefined') {
        return !!result;
      }
    }
    // exit early for identical values
    if (a === b) {
      // treat `+0` vs. `-0` as not equal
      return a !== 0 || (1 / a == 1 / b);
    }
    var type = typeof a,
        otherType = typeof b;

    // exit early for unlike primitive values
    if (a === a &&
        !(a && objectTypes[type]) &&
        !(b && objectTypes[otherType])) {
      return false;
    }
    // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
    // http://es5.github.io/#x15.3.4.4
    if (a == null || b == null) {
      return a === b;
    }
    // compare [[Class]] names
    var className = toString.call(a),
        otherClass = toString.call(b);

    if (className == argsClass) {
      className = objectClass;
    }
    if (otherClass == argsClass) {
      otherClass = objectClass;
    }
    if (className != otherClass) {
      return false;
    }
    switch (className) {
      case boolClass:
      case dateClass:
        // coerce dates and booleans to numbers, dates to milliseconds and booleans
        // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
        return +a == +b;

      case numberClass:
        // treat `NaN` vs. `NaN` as equal
        return (a != +a)
          ? b != +b
          // but treat `+0` vs. `-0` as not equal
          : (a == 0 ? (1 / a == 1 / b) : a == +b);

      case regexpClass:
      case stringClass:
        // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
        // treat string primitives and their corresponding object instances as equal
        return a == String(b);
    }
    var isArr = className == arrayClass;
    if (!isArr) {
      // unwrap any `lodash` wrapped values
      var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
          bWrapped = hasOwnProperty.call(b, '__wrapped__');

      if (aWrapped || bWrapped) {
        return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
      }
      // exit for functions and DOM nodes
      if (className != objectClass) {
        return false;
      }
      // in older versions of Opera, `arguments` objects have `Array` constructors
      var ctorA = !support.argsObject && isArguments(a) ? Object : a.constructor,
          ctorB = !support.argsObject && isArguments(b) ? Object : b.constructor;

      // non `Object` object instances with different constructors are not equal
      if (ctorA != ctorB &&
            !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
            ('constructor' in a && 'constructor' in b)
          ) {
        return false;
      }
    }
    // assume cyclic structures are equal
    // the algorithm for detecting cyclic structures is adapted from ES 5.1
    // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
    var initedStack = !stackA;
    stackA || (stackA = getArray());
    stackB || (stackB = getArray());

    var length = stackA.length;
    while (length--) {
      if (stackA[length] == a) {
        return stackB[length] == b;
      }
    }
    var size = 0;
    result = true;

    // add `a` and `b` to the stack of traversed objects
    stackA.push(a);
    stackB.push(b);

    // recursively compare objects and arrays (susceptible to call stack limits)
    if (isArr) {
      // compare lengths to determine if a deep comparison is necessary
      length = a.length;
      size = b.length;
      result = size == length;

      if (result || isWhere) {
        // deep compare the contents, ignoring non-numeric properties
        while (size--) {
          var index = length,
              value = b[size];

          if (isWhere) {
            while (index--) {
              if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                break;
              }
            }
          } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
            break;
          }
        }
      }
    }
    else {
      // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
      // which, in this case, is more costly
      forIn(b, function(value, key, b) {
        if (hasOwnProperty.call(b, key)) {
          // count the number of properties.
          size++;
          // deep compare each property value.
          return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
        }
      });

      if (result && !isWhere) {
        // ensure both objects have the same number of properties
        forIn(a, function(value, key, a) {
          if (hasOwnProperty.call(a, key)) {
            // `size` will be `-1` if `a` has more properties than `b`
            return (result = --size > -1);
          }
        });
      }
    }
    stackA.pop();
    stackB.pop();

    if (initedStack) {
      releaseArray(stackA);
      releaseArray(stackB);
    }
    return result;
  }

  /**
   * Creates a function that, when called, either curries or invokes `func`
   * with an optional `this` binding and partially applied arguments.
   *
   * @private
   * @param {Function|string} func The function or method name to reference.
   * @param {number} bitmask The bitmask of method flags to compose.
   *  The bitmask may be composed of the following flags:
   *  1 - `_.bind`
   *  2 - `_.bindKey`
   *  4 - `_.curry`
   *  8 - `_.curry` (bound)
   *  16 - `_.partial`
   *  32 - `_.partialRight`
   * @param {Array} [partialArgs] An array of arguments to prepend to those
   *  provided to the new function.
   * @param {Array} [partialRightArgs] An array of arguments to append to those
   *  provided to the new function.
   * @param {*} [thisArg] The `this` binding of `func`.
   * @param {number} [arity] The arity of `func`.
   * @returns {Function} Returns the new function.
   */
  function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
    var isBind = bitmask & 1,
        isBindKey = bitmask & 2,
        isCurry = bitmask & 4,
        isCurryBound = bitmask & 8,
        isPartial = bitmask & 16,
        isPartialRight = bitmask & 32;

    if (!isBindKey && !isFunction(func)) {
      throw new TypeError;
    }
    if (isPartial && !partialArgs.length) {
      bitmask &= ~16;
      isPartial = partialArgs = false;
    }
    if (isPartialRight && !partialRightArgs.length) {
      bitmask &= ~32;
      isPartialRight = partialRightArgs = false;
    }
    var bindData = func && func.__bindData__;
    if (bindData && bindData !== true) {
      // clone `bindData`
      bindData = slice(bindData);
      if (bindData[2]) {
        bindData[2] = slice(bindData[2]);
      }
      if (bindData[3]) {
        bindData[3] = slice(bindData[3]);
      }
      // set `thisBinding` is not previously bound
      if (isBind && !(bindData[1] & 1)) {
        bindData[4] = thisArg;
      }
      // set if previously bound but not currently (subsequent curried functions)
      if (!isBind && bindData[1] & 1) {
        bitmask |= 8;
      }
      // set curried arity if not yet set
      if (isCurry && !(bindData[1] & 4)) {
        bindData[5] = arity;
      }
      // append partial left arguments
      if (isPartial) {
        push.apply(bindData[2] || (bindData[2] = []), partialArgs);
      }
      // append partial right arguments
      if (isPartialRight) {
        unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
      }
      // merge flags
      bindData[1] |= bitmask;
      return createWrapper.apply(null, bindData);
    }
    // fast path for `_.bind`
    var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
    return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
  }

  /**
   * Creates compiled iteration functions.
   *
   * @private
   * @param {...Object} [options] The compile options object(s).
   * @param {string} [options.array] Code to determine if the iterable is an array or array-like.
   * @param {boolean} [options.useHas] Specify using `hasOwnProperty` checks in the object loop.
   * @param {Function} [options.keys] A reference to `_.keys` for use in own property iteration.
   * @param {string} [options.args] A comma separated string of iteration function arguments.
   * @param {string} [options.top] Code to execute before the iteration branches.
   * @param {string} [options.loop] Code to execute in the object loop.
   * @param {string} [options.bottom] Code to execute after the iteration branches.
   * @returns {Function} Returns the compiled function.
   */
  function createIterator() {
    // data properties
    iteratorData.shadowedProps = shadowedProps;

    // iterator options
    iteratorData.array = iteratorData.bottom = iteratorData.loop = iteratorData.top = '';
    iteratorData.init = 'iterable';
    iteratorData.useHas = true;

    // merge options into a template data object
    for (var object, index = 0; object = arguments[index]; index++) {
      for (var key in object) {
        iteratorData[key] = object[key];
      }
    }
    var args = iteratorData.args;
    iteratorData.firstArg = /^[^,]+/.exec(args)[0];

    // create the function factory
    var factory = Function(
        'baseCreateCallback, errorClass, errorProto, hasOwnProperty, ' +
        'indicatorObject, isArguments, isArray, isString, keys, objectProto, ' +
        'objectTypes, nonEnumProps, stringClass, stringProto, toString',
      'return function(' + args + ') {\n' + iteratorTemplate(iteratorData) + '\n}'
    );

    // return the compiled function
    return factory(
      baseCreateCallback, errorClass, errorProto, hasOwnProperty,
      indicatorObject, isArguments, isArray, isString, iteratorData.keys, objectProto,
      objectTypes, nonEnumProps, stringClass, stringProto, toString
    );
  }

  /**
   * Checks if `value` is a native function.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
   */
  function isNative(value) {
    return typeof value == 'function' && reNative.test(value);
  }

  /**
   * Sets `this` binding data on a given function.
   *
   * @private
   * @param {Function} func The function to set data on.
   * @param {Array} value The data array to set.
   */
  var setBindData = !defineProperty ? noop : function(func, value) {
    descriptor.value = value;
    defineProperty(func, '__bindData__', descriptor);
  };

  /*--------------------------------------------------------------------------*/

  /**
   * Checks if `value` is an `arguments` object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
   * @example
   *
   * (function() { return _.isArguments(arguments); })(1, 2, 3);
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  function isArguments(value) {
    return value && typeof value == 'object' && typeof value.length == 'number' &&
      toString.call(value) == argsClass || false;
  }
  // fallback for browsers that can't detect `arguments` objects by [[Class]]
  if (!support.argsClass) {
    isArguments = function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        hasOwnProperty.call(value, 'callee') && !propertyIsEnumerable.call(value, 'callee') || false;
    };
  }

  /**
   * Checks if `value` is an array.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
   * @example
   *
   * (function() { return _.isArray(arguments); })();
   * // => false
   *
   * _.isArray([1, 2, 3]);
   * // => true
   */
  var isArray = nativeIsArray || function(value) {
    return value && typeof value == 'object' && typeof value.length == 'number' &&
      toString.call(value) == arrayClass || false;
  };

  /**
   * A fallback implementation of `Object.keys` which produces an array of the
   * given object's own enumerable property names.
   *
   * @private
   * @type Function
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns an array of property names.
   */
  var shimKeys = createIterator({
    'args': 'object',
    'init': '[]',
    'top': 'if (!(objectTypes[typeof object])) return result',
    'loop': 'result.push(index)'
  });

  /**
   * Creates an array composed of the own enumerable property names of an object.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns an array of property names.
   * @example
   *
   * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
   * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
   */
  var keys = !nativeKeys ? shimKeys : function(object) {
    if (!isObject(object)) {
      return [];
    }
    if ((support.enumPrototypes && typeof object == 'function') ||
        (support.nonEnumArgs && object.length && isArguments(object))) {
      return shimKeys(object);
    }
    return nativeKeys(object);
  };

  /** Reusable iterator options shared by `each`, `forIn`, and `forOwn` */
  var eachIteratorOptions = {
    'args': 'collection, callback, thisArg',
    'top': "callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3)",
    'array': "typeof length == 'number'",
    'keys': keys,
    'loop': 'if (callback(iterable[index], index, collection) === false) return result'
  };

  /** Reusable iterator options for `forIn` and `forOwn` */
  var forOwnIteratorOptions = {
    'top': 'if (!objectTypes[typeof iterable]) return result;\n' + eachIteratorOptions.top,
    'array': false
  };

  /**
   * A function compiled to iterate `arguments` objects, arrays, objects, and
   * strings consistenly across environments, executing the callback for each
   * element in the collection. The callback is bound to `thisArg` and invoked
   * with three arguments; (value, index|key, collection). Callbacks may exit
   * iteration early by explicitly returning `false`.
   *
   * @private
   * @type Function
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|string} Returns `collection`.
   */
  var baseEach = createIterator(eachIteratorOptions);

  /*--------------------------------------------------------------------------*/

  /**
   * Iterates over own and inherited enumerable properties of an object,
   * executing the callback for each property. The callback is bound to `thisArg`
   * and invoked with three arguments; (value, key, object). Callbacks may exit
   * iteration early by explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * function Shape() {
   *   this.x = 0;
   *   this.y = 0;
   * }
   *
   * Shape.prototype.move = function(x, y) {
   *   this.x += x;
   *   this.y += y;
   * };
   *
   * _.forIn(new Shape, function(value, key) {
   *   console.log(key);
   * });
   * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
   */
  var forIn = createIterator(eachIteratorOptions, forOwnIteratorOptions, {
    'useHas': false
  });

  /**
   * Iterates over own enumerable properties of an object, executing the callback
   * for each property. The callback is bound to `thisArg` and invoked with three
   * arguments; (value, key, object). Callbacks may exit iteration early by
   * explicitly returning `false`.
   *
   * @static
   * @memberOf _
   * @type Function
   * @category Objects
   * @param {Object} object The object to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Object} Returns `object`.
   * @example
   *
   * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
   *   console.log(key);
   * });
   * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
   */
  var forOwn = createIterator(eachIteratorOptions, forOwnIteratorOptions);

  /**
   * Creates a sorted array of property names of all enumerable properties,
   * own and inherited, of `object` that have function values.
   *
   * @static
   * @memberOf _
   * @alias methods
   * @category Objects
   * @param {Object} object The object to inspect.
   * @returns {Array} Returns an array of property names that have function values.
   * @example
   *
   * _.functions(_);
   * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
   */
  function functions(object) {
    var result = [];
    forIn(object, function(value, key) {
      if (isFunction(value)) {
        result.push(key);
      }
    });
    return result.sort();
  }

  /**
   * Checks if `value` is a function.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   */
  function isFunction(value) {
    return typeof value == 'function';
  }
  // fallback for older versions of Chrome and Safari
  if (isFunction(/x/)) {
    isFunction = function(value) {
      return typeof value == 'function' && toString.call(value) == funcClass;
    };
  }

  /**
   * Checks if `value` is the language type of Object.
   * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(1);
   * // => false
   */
  function isObject(value) {
    // check if the value is the ECMAScript language type of Object
    // http://es5.github.io/#x8
    // and avoid a V8 bug
    // http://code.google.com/p/v8/issues/detail?id=2291
    return !!(value && objectTypes[typeof value]);
  }

  /**
   * Checks if `value` is a string.
   *
   * @static
   * @memberOf _
   * @category Objects
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
   * @example
   *
   * _.isString('fred');
   * // => true
   */
  function isString(value) {
    return typeof value == 'string' ||
      value && typeof value == 'object' && toString.call(value) == stringClass || false;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Iterates over elements of a collection, returning an array of all elements
   * the callback returns truey for. The callback is bound to `thisArg` and
   * invoked with three arguments; (value, index|key, collection).
   *
   * If a property name is provided for `callback` the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is provided for `callback` the created "_.where" style callback
   * will return `true` for elements that have the properties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias select
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function|Object|string} [callback=identity] The function called
   *  per iteration. If a property name or object is provided it will be used
   *  to create a "_.pluck" or "_.where" style callback, respectively.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that passed the callback check.
   * @example
   *
   * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [2, 4, 6]
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36, 'blocked': false },
   *   { 'name': 'fred',   'age': 40, 'blocked': true }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.filter(characters, 'blocked');
   * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
   *
   * // using "_.where" callback shorthand
   * _.filter(characters, { 'age': 36 });
   * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
   */
  function filter(collection, callback, thisArg) {
    var result = [];
    callback = lodash.createCallback(callback, thisArg, 3);

    if (isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        var value = collection[index];
        if (callback(value, index, collection)) {
          result.push(value);
        }
      }
    } else {
      baseEach(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result.push(value);
        }
      });
    }
    return result;
  }

  /**
   * Iterates over elements of a collection, executing the callback for each
   * element. The callback is bound to `thisArg` and invoked with three arguments;
   * (value, index|key, collection). Callbacks may exit iteration early by
   * explicitly returning `false`.
   *
   * Note: As with other "Collections" methods, objects with a `length` property
   * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
   * may be used for object iteration.
   *
   * @static
   * @memberOf _
   * @alias each
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function} [callback=identity] The function called per iteration.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array|Object|string} Returns `collection`.
   * @example
   *
   * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
   * // => logs each number and returns '1,2,3'
   *
   * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
   * // => logs each number and returns the object (property order is not guaranteed across environments)
   */
  function forEach(collection, callback, thisArg) {
    if (callback && typeof thisArg == 'undefined' && isArray(collection)) {
      var index = -1,
          length = collection.length;

      while (++index < length) {
        if (callback(collection[index], index, collection) === false) {
          break;
        }
      }
    } else {
      baseEach(collection, callback, thisArg);
    }
    return collection;
  }

  /**
   * Creates an array of values by running each element in the collection
   * through the callback. The callback is bound to `thisArg` and invoked with
   * three arguments; (value, index|key, collection).
   *
   * If a property name is provided for `callback` the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is provided for `callback` the created "_.where" style callback
   * will return `true` for elements that have the properties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @alias collect
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function|Object|string} [callback=identity] The function called
   *  per iteration. If a property name or object is provided it will be used
   *  to create a "_.pluck" or "_.where" style callback, respectively.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of the results of each `callback` execution.
   * @example
   *
   * _.map([1, 2, 3], function(num) { return num * 3; });
   * // => [3, 6, 9]
   *
   * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
   * // => [3, 6, 9] (property order is not guaranteed across environments)
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36 },
   *   { 'name': 'fred',   'age': 40 }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.map(characters, 'name');
   * // => ['barney', 'fred']
   */
  function map(collection, callback, thisArg) {
    var index = -1,
        length = collection ? collection.length : 0,
        result = Array(typeof length == 'number' ? length : 0);

    callback = lodash.createCallback(callback, thisArg, 3);
    if (isArray(collection)) {
      while (++index < length) {
        result[index] = callback(collection[index], index, collection);
      }
    } else {
      baseEach(collection, function(value, key, collection) {
        result[++index] = callback(value, key, collection);
      });
    }
    return result;
  }

  /**
   * The opposite of `_.filter` this method returns the elements of a
   * collection that the callback does **not** return truey for.
   *
   * If a property name is provided for `callback` the created "_.pluck" style
   * callback will return the property value of the given element.
   *
   * If an object is provided for `callback` the created "_.where" style callback
   * will return `true` for elements that have the properties of the given object,
   * else `false`.
   *
   * @static
   * @memberOf _
   * @category Collections
   * @param {Array|Object|string} collection The collection to iterate over.
   * @param {Function|Object|string} [callback=identity] The function called
   *  per iteration. If a property name or object is provided it will be used
   *  to create a "_.pluck" or "_.where" style callback, respectively.
   * @param {*} [thisArg] The `this` binding of `callback`.
   * @returns {Array} Returns a new array of elements that failed the callback check.
   * @example
   *
   * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
   * // => [1, 3, 5]
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36, 'blocked': false },
   *   { 'name': 'fred',   'age': 40, 'blocked': true }
   * ];
   *
   * // using "_.pluck" callback shorthand
   * _.reject(characters, 'blocked');
   * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
   *
   * // using "_.where" callback shorthand
   * _.reject(characters, { 'age': 36 });
   * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
   */
  function reject(collection, callback, thisArg) {
    callback = lodash.createCallback(callback, thisArg, 3);
    return filter(collection, function(value, index, collection) {
      return !callback(value, index, collection);
    });
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a function that, when called, invokes `func` with the `this`
   * binding of `thisArg` and prepends any additional `bind` arguments to those
   * provided to the bound function.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to bind.
   * @param {*} [thisArg] The `this` binding of `func`.
   * @param {...*} [arg] Arguments to be partially applied.
   * @returns {Function} Returns the new bound function.
   * @example
   *
   * var func = function(greeting) {
   *   return greeting + ' ' + this.name;
   * };
   *
   * func = _.bind(func, { 'name': 'fred' }, 'hi');
   * func();
   * // => 'hi fred'
   */
  function bind(func, thisArg) {
    return arguments.length > 2
      ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
      : createWrapper(func, 1, null, null, thisArg);
  }

  /**
   * Creates a function that will delay the execution of `func` until after
   * `wait` milliseconds have elapsed since the last time it was invoked.
   * Provide an options object to indicate that `func` should be invoked on
   * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
   * to the debounced function will return the result of the last `func` call.
   *
   * Note: If `leading` and `trailing` options are `true` `func` will be called
   * on the trailing edge of the timeout only if the the debounced function is
   * invoked more than once during the `wait` timeout.
   *
   * @static
   * @memberOf _
   * @category Functions
   * @param {Function} func The function to debounce.
   * @param {number} wait The number of milliseconds to delay.
   * @param {Object} [options] The options object.
   * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
   * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
   * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
   * @returns {Function} Returns the new debounced function.
   * @example
   *
   * // avoid costly calculations while the window size is in flux
   * var lazyLayout = _.debounce(calculateLayout, 150);
   * jQuery(window).on('resize', lazyLayout);
   *
   * // execute `sendMail` when the click event is fired, debouncing subsequent calls
   * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
   *   'leading': true,
   *   'trailing': false
   * });
   *
   * // ensure `batchLog` is executed once after 1 second of debounced calls
   * var source = new EventSource('/stream');
   * source.addEventListener('message', _.debounce(batchLog, 250, {
   *   'maxWait': 1000
   * }, false);
   */
  function debounce(func, wait, options) {
    var args,
        maxTimeoutId,
        result,
        stamp,
        thisArg,
        timeoutId,
        trailingCall,
        lastCalled = 0,
        maxWait = false,
        trailing = true;

    if (!isFunction(func)) {
      throw new TypeError;
    }
    wait = nativeMax(0, wait) || 0;
    if (options === true) {
      var leading = true;
      trailing = false;
    } else if (isObject(options)) {
      leading = options.leading;
      maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
      trailing = 'trailing' in options ? options.trailing : trailing;
    }
    var delayed = function() {
      var remaining = wait - (now() - stamp);
      if (remaining <= 0) {
        if (maxTimeoutId) {
          clearTimeout(maxTimeoutId);
        }
        var isCalled = trailingCall;
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (isCalled) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      } else {
        timeoutId = setTimeout(delayed, remaining);
      }
    };

    var maxDelayed = function() {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      maxTimeoutId = timeoutId = trailingCall = undefined;
      if (trailing || (maxWait !== wait)) {
        lastCalled = now();
        result = func.apply(thisArg, args);
        if (!timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
      }
    };

    return function() {
      args = arguments;
      stamp = now();
      thisArg = this;
      trailingCall = trailing && (timeoutId || !leading);

      if (maxWait === false) {
        var leadingCall = leading && !timeoutId;
      } else {
        if (!maxTimeoutId && !leading) {
          lastCalled = stamp;
        }
        var remaining = maxWait - (stamp - lastCalled),
            isCalled = remaining <= 0;

        if (isCalled) {
          if (maxTimeoutId) {
            maxTimeoutId = clearTimeout(maxTimeoutId);
          }
          lastCalled = stamp;
          result = func.apply(thisArg, args);
        }
        else if (!maxTimeoutId) {
          maxTimeoutId = setTimeout(maxDelayed, remaining);
        }
      }
      if (isCalled && timeoutId) {
        timeoutId = clearTimeout(timeoutId);
      }
      else if (!timeoutId && wait !== maxWait) {
        timeoutId = setTimeout(delayed, wait);
      }
      if (leadingCall) {
        isCalled = true;
        result = func.apply(thisArg, args);
      }
      if (isCalled && !timeoutId && !maxTimeoutId) {
        args = thisArg = null;
      }
      return result;
    };
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Produces a callback bound to an optional `thisArg`. If `func` is a property
   * name the created callback will return the property value for a given element.
   * If `func` is an object the created callback will return `true` for elements
   * that contain the equivalent object properties, otherwise it will return `false`.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {*} [func=identity] The value to convert to a callback.
   * @param {*} [thisArg] The `this` binding of the created callback.
   * @param {number} [argCount] The number of arguments the callback accepts.
   * @returns {Function} Returns a callback function.
   * @example
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36 },
   *   { 'name': 'fred',   'age': 40 }
   * ];
   *
   * // wrap to create custom callback shorthands
   * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
   *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
   *   return !match ? func(callback, thisArg) : function(object) {
   *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
   *   };
   * });
   *
   * _.filter(characters, 'age__gt38');
   * // => [{ 'name': 'fred', 'age': 40 }]
   */
  function createCallback(func, thisArg, argCount) {
    var type = typeof func;
    if (func == null || type == 'function') {
      return baseCreateCallback(func, thisArg, argCount);
    }
    // handle "_.pluck" style callback shorthands
    if (type != 'object') {
      return property(func);
    }
    var props = keys(func),
        key = props[0],
        a = func[key];

    // handle "_.where" style callback shorthands
    if (props.length == 1 && a === a && !isObject(a)) {
      // fast path the common case of providing an object with a single
      // property containing a primitive value
      return function(object) {
        var b = object[key];
        return a === b && (a !== 0 || (1 / a == 1 / b));
      };
    }
    return function(object) {
      var length = props.length,
          result = false;

      while (length--) {
        if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
          break;
        }
      }
      return result;
    };
  }

  /**
   * This method returns the first argument provided to it.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {*} value Any value.
   * @returns {*} Returns `value`.
   * @example
   *
   * var object = { 'name': 'fred' };
   * _.identity(object) === object;
   * // => true
   */
  function identity(value) {
    return value;
  }

  /**
   * Adds function properties of a source object to the destination object.
   * If `object` is a function methods will be added to its prototype as well.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Function|Object} [object=lodash] object The destination object.
   * @param {Object} source The object of functions to add.
   * @param {Object} [options] The options object.
   * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
   * @example
   *
   * function capitalize(string) {
   *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
   * }
   *
   * _.mixin({ 'capitalize': capitalize });
   * _.capitalize('fred');
   * // => 'Fred'
   *
   * _('fred').capitalize().value();
   * // => 'Fred'
   *
   * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
   * _('fred').capitalize();
   * // => 'Fred'
   */
  function mixin(object, source, options) {
    var chain = true,
        methodNames = source && functions(source);

    if (!source || (!options && !methodNames.length)) {
      if (options == null) {
        options = source;
      }
      ctor = lodashWrapper;
      source = object;
      object = lodash;
      methodNames = functions(source);
    }
    if (options === false) {
      chain = false;
    } else if (isObject(options) && 'chain' in options) {
      chain = options.chain;
    }
    var ctor = object,
        isFunc = isFunction(ctor);

    forEach(methodNames, function(methodName) {
      var func = object[methodName] = source[methodName];
      if (isFunc) {
        ctor.prototype[methodName] = function() {
          var chainAll = this.__chain__,
              value = this.__wrapped__,
              args = [value];

          push.apply(args, arguments);
          var result = func.apply(object, args);
          if (chain || chainAll) {
            if (value === result && isObject(result)) {
              return this;
            }
            result = new ctor(result);
            result.__chain__ = chainAll;
          }
          return result;
        };
      }
    });
  }

  /**
   * A no-operation function.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @example
   *
   * var object = { 'name': 'fred' };
   * _.noop(object) === undefined;
   * // => true
   */
  function noop() {
    // no operation performed
  }

  /**
   * Gets the number of milliseconds that have elapsed since the Unix epoch
   * (1 January 1970 00:00:00 UTC).
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @example
   *
   * var stamp = _.now();
   * _.defer(function() { console.log(_.now() - stamp); });
   * // => logs the number of milliseconds it took for the deferred function to be called
   */
  var now = isNative(now = Date.now) && now || function() {
    return new Date().getTime();
  };

  /**
   * Creates a "_.pluck" style function, which returns the `key` value of a
   * given object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {string} key The name of the property to retrieve.
   * @returns {Function} Returns the new function.
   * @example
   *
   * var characters = [
   *   { 'name': 'fred',   'age': 40 },
   *   { 'name': 'barney', 'age': 36 }
   * ];
   *
   * var getName = _.property('name');
   *
   * _.map(characters, getName);
   * // => ['barney', 'fred']
   *
   * _.sortBy(characters, getName);
   * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
   */
  function property(key) {
    return function(object) {
      return object[key];
    };
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Creates a `lodash` object that wraps the given value with explicit
   * method chaining enabled.
   *
   * @static
   * @memberOf _
   * @category Chaining
   * @param {*} value The value to wrap.
   * @returns {Object} Returns the wrapper object.
   * @example
   *
   * var characters = [
   *   { 'name': 'barney',  'age': 36 },
   *   { 'name': 'fred',    'age': 40 },
   *   { 'name': 'pebbles', 'age': 1 }
   * ];
   *
   * var youngest = _.chain(characters)
   *     .sortBy('age')
   *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
   *     .first()
   *     .value();
   * // => 'pebbles is 1'
   */
  function chain(value) {
    value = new lodashWrapper(value);
    value.__chain__ = true;
    return value;
  }

  /**
   * Enables explicit method chaining on the wrapper object.
   *
   * @name chain
   * @memberOf _
   * @category Chaining
   * @returns {*} Returns the wrapper object.
   * @example
   *
   * var characters = [
   *   { 'name': 'barney', 'age': 36 },
   *   { 'name': 'fred',   'age': 40 }
   * ];
   *
   * // without explicit chaining
   * _(characters).first();
   * // => { 'name': 'barney', 'age': 36 }
   *
   * // with explicit chaining
   * _(characters).chain()
   *   .first()
   *   .pick('age')
   *   .value();
   * // => { 'age': 36 }
   */
  function wrapperChain() {
    this.__chain__ = true;
    return this;
  }

  /**
   * Produces the `toString` result of the wrapped value.
   *
   * @name toString
   * @memberOf _
   * @category Chaining
   * @returns {string} Returns the string result.
   * @example
   *
   * _([1, 2, 3]).toString();
   * // => '1,2,3'
   */
  function wrapperToString() {
    return String(this.__wrapped__);
  }

  /**
   * Extracts the wrapped value.
   *
   * @name valueOf
   * @memberOf _
   * @alias value
   * @category Chaining
   * @returns {*} Returns the wrapped value.
   * @example
   *
   * _([1, 2, 3]).valueOf();
   * // => [1, 2, 3]
   */
  function wrapperValueOf() {
    return this.__wrapped__;
  }

  /*--------------------------------------------------------------------------*/

  lodash.bind = bind;
  lodash.chain = chain;
  lodash.createCallback = createCallback;
  lodash.debounce = debounce;
  lodash.filter = filter;
  lodash.forEach = forEach;
  lodash.forIn = forIn;
  lodash.forOwn = forOwn;
  lodash.functions = functions;
  lodash.keys = keys;
  lodash.map = map;
  lodash.property = property;
  lodash.reject = reject;

  // add aliases
  lodash.collect = map;
  lodash.each = forEach;
  lodash.methods = functions;
  lodash.select = filter;

  // add functions to `lodash.prototype`
  mixin(lodash);

  /*--------------------------------------------------------------------------*/

  lodash.identity = identity;
  lodash.isArguments = isArguments;
  lodash.isArray = isArray;
  lodash.isFunction = isFunction;
  lodash.isObject = isObject;
  lodash.isString = isString;
  lodash.mixin = mixin;
  lodash.noop = noop;
  lodash.now = now;

  mixin(function() {
    var source = {}
    forOwn(lodash, function(func, methodName) {
      if (!lodash.prototype[methodName]) {
        source[methodName] = func;
      }
    });
    return source;
  }(), false);

  /*--------------------------------------------------------------------------*/

  forOwn(lodash, function(func, methodName) {
    var callbackable = methodName !== 'sample';
    if (!lodash.prototype[methodName]) {
      lodash.prototype[methodName]= function(n, guard) {
        var chainAll = this.__chain__,
            result = func(this.__wrapped__, n, guard);

        return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
          ? result
          : new lodashWrapper(result, chainAll);
      };
    }
  });

  /*--------------------------------------------------------------------------*/

  /**
   * The semantic version number.
   *
   * @static
   * @memberOf _
   * @type string
   */
  lodash.VERSION = '2.4.1';

  // add "Chaining" functions to the wrapper
  lodash.prototype.chain = wrapperChain;
  lodash.prototype.toString = wrapperToString;
  lodash.prototype.value = wrapperValueOf;
  lodash.prototype.valueOf = wrapperValueOf;

  // add `Array` functions that return unwrapped values
  baseEach(['join', 'pop', 'shift'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      var chainAll = this.__chain__,
          result = func.apply(this.__wrapped__, arguments);

      return chainAll
        ? new lodashWrapper(result, chainAll)
        : result;
    };
  });

  // add `Array` functions that return the existing wrapped value
  baseEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      func.apply(this.__wrapped__, arguments);
      return this;
    };
  });

  // add `Array` functions that return new wrapped values
  baseEach(['concat', 'slice', 'splice'], function(methodName) {
    var func = arrayRef[methodName];
    lodash.prototype[methodName] = function() {
      return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
    };
  });

  // avoid array-like object bugs with `Array#shift` and `Array#splice`
  // in IE < 9, Firefox < 10, Narwhal, and RingoJS
  if (!support.spliceObjects) {
    baseEach(['pop', 'shift', 'splice'], function(methodName) {
      var func = arrayRef[methodName],
          isSplice = methodName == 'splice';

      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            value = this.__wrapped__,
            result = func.apply(value, arguments);

        if (value.length === 0) {
          delete value[0];
        }
        return (chainAll || isSplice)
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });
  }

  /*--------------------------------------------------------------------------*/

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = lodash;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return lodash;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = lodash)._ = lodash;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = lodash;
    }
  }
  else {
    // in a browser or Rhino
    root._ = lodash;
  }
}.call(this));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(require,module,exports){
var xml = require('./xml');
var blockUtils = require('./block_utils');
var utils = require('./utils');

/**
 * Create the textual XML for a math_number block.
 * @param {number|string} number The numeric amount, expressed as a
 *     number or string.  Non-numeric strings may also be specified,
 *     such as '???'.
 * @return {string} The textual representation of a math_number block.
 */
exports.makeMathNumber = function(number) {
  return '<block type="math_number"><title name="NUM">' +
    number + '</title></block>';
};

/**
 * Generate a required blocks dictionary for a simple block that does not
 * have any parameters or values.
 * @param {string} block_type The block type.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.simpleBlock = function(block_type) {
  return {test: function(block) {return block.type == block_type; },
    type: block_type};
};

/**
 * Generate a required blocks dictionary for a repeat loop.  This does not
 * test for the specified repeat count but includes it in the suggested block.
 * @param {number|string} count The suggested repeat count.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.repeat = function(count) {
  // This checks for a controls_repeat block rather than looking for 'for',
  // since the latter may be generated by Turtle 2's draw_a_square.
  return {test: function(block) {return block.type == 'controls_repeat';},
    type: 'controls_repeat', titles: {'TIMES': count}};
};

/**
 * Generate a required blocks dictionary for a simple repeat loop.  This does not
 * test for the specified repeat count but includes it in the suggested block.
 * @param {number|string} count The suggested repeat count.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.repeatSimpleBlock = function(count) {
  return {test: function(block) {return block.type == 'controls_repeat_simplified';},
    type: 'controls_repeat_simplified', titles: {'TIMES': count}};
};

/**
 * Returns an array of required blocks by comparing a list of blocks with
 * a list of app specific block tests (defined in <app>/requiredBlocks.js)
 */
exports.makeTestsFromBuilderRequiredBlocks = function (customRequiredBlocks) {
  var blocksXml = xml.parseElement(customRequiredBlocks);

  var requiredBlocksTests = [];
  Array.prototype.forEach.call(blocksXml.children, function(requiredBlockXML) {
    requiredBlocksTests.push([{
      test: function(userBlock) {
        var temporaryRequiredBlock = blockUtils.domToBlock(requiredBlockXML);
        var blockMeetsRequirements = exports.blocksMatch(userBlock, temporaryRequiredBlock);
        temporaryRequiredBlock.dispose();
        return blockMeetsRequirements;
      },
      blockDisplayXML: xml.serialize(requiredBlockXML)
    }]);
  });

  return requiredBlocksTests;
};

/**
 * Checks if two blocks are "equivalent"
 * Currently means their type and all of their titles match exactly
 * @param blockA
 * @param blockB
 */
exports.blocksMatch = function(blockA, blockB) {
  var typesMatch = blockA.type === blockB.type;
  var titlesMatch = exports.blockTitlesMatch(blockA, blockB);
  return typesMatch && titlesMatch;
};

/**
 * Compares two blocks' titles, returns true if they all match
 * @returns {boolean}
 * @param blockA
 * @param blockB
 */
exports.blockTitlesMatch = function(blockA, blockB) {
  var blockATitles = blockA.getTitles();
  var blockBTitles = blockB.getTitles();

  var nameCompare = function(a,b) { return a.name < b.name; };
  blockATitles.sort(nameCompare);
  blockBTitles.sort(nameCompare);

  for (var i = 0; i < blockATitles.length || i < blockBTitles.length; i++) {
    var blockATitle = blockATitles[i];
    var blockBTitle = blockBTitles[i];
    if (!blockATitle || !blockBTitle ||
      !titlesMatch(blockATitle, blockBTitle)) {
      return false;
    }
  }
  return true;
};

var titlesMatch = function(titleA, titleB) {
  return titleB.name === titleA.name &&
    titleB.getValue() === titleA.getValue();
};

},{"./block_utils":3,"./utils":34,"./xml":35}],11:[function(require,module,exports){
// avatar: A 1029x51 set of 21 avatar images.

exports.load = function(assetUrl, id) {
  var skinUrl = function(path) {
    if (path !== undefined) {
      return assetUrl('media/skins/' + id + '/' + path);
    } else {
      return null;
    }
  };
  var skin = {
    id: id,
    assetUrl: skinUrl,
    // Images
    avatar: skinUrl('avatar.png'),
    tiles: skinUrl('tiles.png'),
    goal: skinUrl('goal.png'),
    obstacle: skinUrl('obstacle.png'),
    smallStaticAvatar: skinUrl('small_static_avatar.png'),
    staticAvatar: skinUrl('static_avatar.png'),
    winAvatar: skinUrl('win_avatar.png'),
    failureAvatar: skinUrl('failure_avatar.png'),
    repeatImage: assetUrl('media/common_images/repeat-arrows.png'),
    leftArrow: assetUrl('media/common_images/move-west-arrow.png'),
    downArrow: assetUrl('media/common_images/move-south-arrow.png'),
    upArrow: assetUrl('media/common_images/move-north-arrow.png'),
    rightArrow: assetUrl('media/common_images/move-east-arrow.png'),
    leftArrowSmall: assetUrl('media/common_images/draw-west-arrow.png'),
    downArrowSmall: assetUrl('media/common_images/draw-south-arrow.png'),
    upArrowSmall: assetUrl('media/common_images/draw-north-arrow.png'),
    rightArrowSmall: assetUrl('media/common_images/draw-east-arrow.png'),
    leftJumpArrow: assetUrl('media/common_images/jump-west-arrow.png'),
    downJumpArrow: assetUrl('media/common_images/jump-south-arrow.png'),
    upJumpArrow: assetUrl('media/common_images/jump-north-arrow.png'),
    rightJumpArrow: assetUrl('media/common_images/jump-east-arrow.png'),
    shortLineDraw: assetUrl('media/common_images/draw-short-line-crayon.png'),
    longLineDraw: assetUrl('media/common_images/draw-long-line-crayon.png'),
    clickIcon: assetUrl('media/common_images/when-click-hand.png'),
    startIcon: assetUrl('media/common_images/start-icon.png'),
    endIcon: assetUrl('media/common_images/end-icon.png'),
    randomPurpleIcon: assetUrl('media/common_images/random-purple.png'),
    // Sounds
    startSound: [skinUrl('start.mp3'), skinUrl('start.ogg')],
    winSound: [skinUrl('win.mp3'), skinUrl('win.ogg')],
    failureSound: [skinUrl('failure.mp3'), skinUrl('failure.ogg')]
  };
  return skin;
};

},{}],12:[function(require,module,exports){
/**
 * Blockly Apps: SVG Slider
 *
 * Copyright 2012 Google Inc.
 * http://blockly.googlecode.com/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview A slider control in SVG.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

/**
 * Object representing a horizontal slider widget.
 * @param {number} x The horizontal offset of the slider.
 * @param {number} y The vertical offset of the slider.
 * @param {number} width The total width of the slider.
 * @param {!Element} svgParent The SVG element to append the slider to.
 * @param {Function} opt_changeFunc Optional callback function that will be
 *     called when the slider is moved.  The current value is passed.
 * @constructor
 */
var Slider = function(x, y, width, svgParent, opt_changeFunc) {
  this.KNOB_Y_ = y - 12;
  this.KNOB_MIN_X_ = x + 8;
  this.KNOB_MAX_X_ = x + width - 8;
  this.value_ = 0.5;
  this.changeFunc_ = opt_changeFunc;

  // Draw the slider.
  /*
  <line class="sliderTrack" x1="10" y1="35" x2="140" y2="35" />
  <path id="knob"
      transform="translate(67, 23)"
      d="m 8,0 l -8,8 v 12 h 16 v -12 z" />
  */
  var track = document.createElementNS(Slider.SVG_NS_, 'line');
  track.setAttribute('class', 'sliderTrack');
  track.setAttribute('x1', x);
  track.setAttribute('y1', y);
  track.setAttribute('x2', x + width);
  track.setAttribute('y2', y);
  svgParent.appendChild(track);
  this.track_ = track;
  var knob = document.createElementNS(Slider.SVG_NS_, 'path');
  knob.setAttribute('class', 'sliderKnob');
  knob.setAttribute('d', 'm 0,0 l -8,8 v 12 h 16 v -12 z');
  svgParent.appendChild(knob);
  this.knob_ = knob;
  this.setValue(0.5);

  // Find the root SVG object.
  while (svgParent && svgParent.nodeName.toLowerCase() != 'svg') {
    svgParent = svgParent.parentNode;
  }
  this.SVG_ = svgParent;

  // Bind the events to this slider.
  var thisSlider = this;
  Slider.bindEvent_(this.knob_, 'mousedown', function(e) {
    return thisSlider.knobMouseDown_(e);
  });
  Slider.bindEvent_(this.SVG_, 'mouseup', Slider.knobMouseUp_);
  Slider.bindEvent_(this.SVG_, 'mousemove', Slider.knobMouseMove_);
  Slider.bindEvent_(document, 'mouseover', Slider.mouseOver_);
};

Slider.SVG_NS_ = 'http://www.w3.org/2000/svg';

Slider.activeSlider_ = null;
Slider.startMouseX_ = 0;
Slider.startKnobX_ = 0;

/**
 * Start a drag when clicking down on the knob.
 * @param {!Event} e Mouse-down event.
 * @private
 */
Slider.prototype.knobMouseDown_ = function(e) {
  Slider.activeSlider_ = this;
  Slider.startMouseX_ = this.mouseToSvg_(e).x;
  Slider.startKnobX_ = 0;
  var transform = this.knob_.getAttribute('transform');
  if (transform) {
    var r = transform.match(/translate\(\s*([-\d.]+)/);
    if (r) {
      Slider.startKnobX_ = Number(r[1]);
    }
  }
  // Stop browser from attempting to drag the knob.
  e.preventDefault();
  return false;
};

/**
 * Stop a drag when clicking up anywhere.
 * @param {Event} e Mouse-up event.
 * @private
 */
Slider.knobMouseUp_ = function(e) {
  Slider.activeSlider_ = null;
};

/**
 * Stop a drag when the mouse enters a node not part of the SVG.
 * @param {Event} e Mouse-up event.
 * @private
 */
Slider.mouseOver_ = function(e) {
  if (!Slider.activeSlider_) {
    return;
  }
  // Find the root SVG object.
  for (var node = e.target; node; node = node.parentNode) {
    if (node == Slider.activeSlider_.SVG_) {
      return;
    }
  }
  Slider.knobMouseUp_(e);
};

/**
 * Drag the knob to follow the mouse.
 * @param {!Event} e Mouse-move event.
 * @private
 */
Slider.knobMouseMove_ = function(e) {
  var thisSlider = Slider.activeSlider_;
  if (!thisSlider) {
    return;
  }
  var x = thisSlider.mouseToSvg_(e).x - Slider.startMouseX_ +
      Slider.startKnobX_;
  x = Math.min(Math.max(x, thisSlider.KNOB_MIN_X_), thisSlider.KNOB_MAX_X_);
  thisSlider.knob_.setAttribute('transform',
      'translate(' + x + ',' + thisSlider.KNOB_Y_ + ')');

  thisSlider.value_ = (x - thisSlider.KNOB_MIN_X_) /
      (thisSlider.KNOB_MAX_X_ - thisSlider.KNOB_MIN_X_);
  if (thisSlider.changeFunc_) {
    thisSlider.changeFunc_(thisSlider.value_);
  }
};

/**
 * Returns the slider's value (0.0 - 1.0).
 * @return {number} Current value.
 */
Slider.prototype.getValue = function() {
  return this.value_;
};

/**
 * Sets the slider's value (0.0 - 1.0).
 * @param {number} value New value.
 */
Slider.prototype.setValue = function(value) {
  this.value_ = Math.min(Math.max(value, 0), 1);
  var x = this.KNOB_MIN_X_ +
      (this.KNOB_MAX_X_ - this.KNOB_MIN_X_) * this.value_;
  this.knob_.setAttribute('transform',
      'translate(' + x + ',' + this.KNOB_Y_ + ')');
};

/**
 * Convert the mouse coordinates into SVG coordinates.
 * @param {!Object} e Object with x and y mouse coordinates.
 * @return {!Object} Object with x and y properties in SVG coordinates.
 * @private
 */
Slider.prototype.mouseToSvg_ = function(e) {
  var svgPoint = this.SVG_.createSVGPoint();
  svgPoint.x = e.clientX;
  svgPoint.y = e.clientY;
  var matrix = this.SVG_.getScreenCTM().inverse();
  return svgPoint.matrixTransform(matrix);
};

/**
 * Bind an event to a function call.
 * @param {!Element} element Element upon which to listen.
 * @param {string} name Event name to listen to (e.g. 'mousedown').
 * @param {!Function} func Function to call when event is triggered.
 * @private
 */
Slider.bindEvent_ = function(element, name, func) {
  element.addEventListener(name, func, false);
};

module.exports = Slider;

},{}],13:[function(require,module,exports){
var tiles = require('./tiles');
var xFromPosition = tiles.xFromPosition;
var yFromPosition = tiles.yFromPosition;

exports.SpriteSpeed = {
  VERY_SLOW: 0.04,
  SLOW: 0.06,
  NORMAL: 0.1,
  FAST: 0.15,
  VERY_FAST: 0.23
};

exports.random = function (values) {
  var key = Math.floor(Math.random() * values.length); 
  return values[key];
};

exports.setBackground = function (id, value) {
  Studio.queueCmd(id, 'setBackground', {'value': value});
};

exports.setSprite = function (id, spriteIndex, value) {
  Studio.queueCmd(id,
                  'setSprite',
                  {'index': spriteIndex, 'value': value});
};

exports.saySprite = function (id, spriteIndex, text) {
  Studio.queueCmd(id, 'saySprite', {'spriteIndex': spriteIndex, 'text': text});
};

exports.showTitleScreen = function (id, title, text) {
  Studio.queueCmd(id, 'showTitleScreen', {'title': title, 'text': text});
};

exports.setSpriteEmotion = function (id, spriteIndex, value) {
  Studio.queueCmd(id,
                  'setSpriteEmotion',
                  {'spriteIndex': spriteIndex, 'value': value});
};

exports.setSpriteSpeed = function (id, spriteIndex, value) {
  Studio.queueCmd(id,
                  'setSpriteSpeed',
                  {'spriteIndex': spriteIndex, 'value': value});
};

exports.setSpritePosition = function (id, spriteIndex, value) {
  Studio.queueCmd(id,
                  'setSpritePosition',
                  {'spriteIndex': spriteIndex,
                   'x': xFromPosition[value],
                   'y': yFromPosition[value]});
};

exports.playSound = function(id, soundName) {
  Studio.queueCmd(id, 'playSound', {'soundName': soundName});
};

exports.stop = function(id, spriteIndex) {
  Studio.queueCmd(id, 'stop', {'spriteIndex': spriteIndex});
};

exports.move = function(id, spriteIndex, dir) {
  Studio.queueCmd(id, 'move', {'spriteIndex': spriteIndex, 'dir': dir});
};

exports.moveDistance = function(id, spriteIndex, dir, distance) {
  Studio.queueCmd(
      id,
      'moveDistance',
      {'spriteIndex': spriteIndex, 'dir': dir, 'distance': distance});
};

exports.incrementScore = function(id, player) {
  Studio.queueCmd(id, 'incrementScore', {'player': player});
};

exports.setScoreText = function(id, text) {
  Studio.queueCmd(id, 'setScoreText', {'text': text});
};

exports.wait = function(id, value) {
  Studio.queueCmd(id, 'wait', {'value': value});
};

},{"./tiles":21}],14:[function(require,module,exports){
/**
 * Blockly App: Studio
 *
 * Copyright 2014 Code.org
 *
 */
'use strict';

var msg = require('../../locale/pt_pt/studio');
var codegen = require('../codegen');
var tiles = require('./tiles');

var Direction = tiles.Direction;
var Position = tiles.Position;
var Emotions = tiles.Emotions;

var generateSetterCode = function (opts) {
  var value = opts.ctx.getTitleValue('VALUE');
  if (value === "random") {
    var randomIndex = opts.random || 0;
    // opts.random is the index of where the 'random' items is in beginning of
    // the VALUES table (defaults to 0).
    var allValues = opts.ctx.VALUES.slice(randomIndex + 1).map(function (item) {
      return item[1];
    });
    value = 'Studio.random([' + allValues + '])';
  }

  return 'Studio.' + opts.name + '(\'block_id_' + opts.ctx.id + '\', ' +
    (opts.extraParams ? opts.extraParams + ', ' : '') + value + ');\n';
};

exports.setSpriteCount = function(blockly, count) {
  blockly.Blocks.studio_spriteCount = count;
};

// Install extensions to Blockly's language and JavaScript generator.
exports.install = function(blockly, blockInstallOptions) {
  var skin = blockInstallOptions.skin;
  var isK1 = blockInstallOptions.isK1;
  var generator = blockly.Generator.get('JavaScript');
  blockly.JavaScript = generator;

  generator.studio_eventHandlerPrologue = function() {
    return '\n';
  };

  blockly.Blocks.studio_spriteCount = 6;

  blockly.Blocks.studio_whenLeft = {
    // Block to handle event when the Left arrow button is pressed.
    helpUrl: '',
    init: function() {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenLeft());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenLeftTooltip());
    }
  };

  generator.studio_whenLeft = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_whenRight = {
    // Block to handle event when the Right arrow button is pressed.
    helpUrl: '',
    init: function() {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenRight());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenRightTooltip());
    }
  };

  generator.studio_whenRight = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_whenUp = {
    // Block to handle event when the Up arrow button is pressed.
    helpUrl: '',
    init: function() {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenUp());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenUpTooltip());
    }
  };

  generator.studio_whenUp = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_whenDown = {
    // Block to handle event when the Down arrow button is pressed.
    helpUrl: '',
    init: function() {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenDown());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenDownTooltip());
    }
  };

  generator.studio_whenDown = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_whenGameStarts = {
    // Block to handle event when the game starts
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenGameStarts());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenGameStartsTooltip());
    }
  };

  generator.studio_whenGameStarts = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_repeatForever = {
    // Block to handle the repeating tick event while the game is running.
    helpUrl: '',
    init: function () {
      this.setHSV(322, 0.90, 0.95);
      this.appendDummyInput()
        .appendTitle(msg.repeatForever());
      this.appendStatementInput('DO')
        .appendTitle(msg.repeatDo());
      this.setPreviousStatement(false);
      this.setNextStatement(false);
      this.setTooltip(msg.repeatForeverTooltip());
    }
  };

  generator.studio_repeatForever = function () {
    var branch = Blockly.JavaScript.statementToCode(this, 'DO');
    return generator.studio_eventHandlerPrologue() + branch;
  };

  blockly.Blocks.studio_whenSpriteClicked = {
    // Block to handle event when sprite is clicked.
    helpUrl: '',
    init: function() {
      this.setHSV(140, 1.00, 0.74);
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.whenSpriteClicked());
      }
      this.setPreviousStatement(false);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.whenSpriteClickedTooltip());
    },
  };

  blockly.Blocks.studio_whenSpriteClicked.SPRITE =
    [[msg.whenSpriteClicked1(), '0'],
     [msg.whenSpriteClicked2(), '1'],
     [msg.whenSpriteClicked3(), '2'],
     [msg.whenSpriteClicked4(), '3'],
     [msg.whenSpriteClicked5(), '4'],
     [msg.whenSpriteClicked6(), '5']];

  generator.studio_whenSpriteClicked = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_whenSpriteCollided = {
    // Block to handle event when sprite collides with another sprite.
    helpUrl: '',
    init: function() {
      var dropdownArray1 =
          this.SPRITE1.slice(0, blockly.Blocks.studio_spriteCount);
      var dropdownArray2 =
          this.SPRITE2.slice(0, blockly.Blocks.studio_spriteCount);
      var dropdown2 = new blockly.FieldDropdown(dropdownArray2);
      if (blockly.Blocks.studio_spriteCount > 1) {
        dropdown2.setValue(dropdownArray2[1][1]); // default to 2
      }

      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(new blockly.FieldDropdown(dropdownArray1), 'SPRITE1');
      this.appendDummyInput()
        .appendTitle(dropdown2, 'SPRITE2');
      this.setPreviousStatement(false);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.whenSpriteCollidedTooltip());
    }
  };

  blockly.Blocks.studio_whenSpriteCollided.SPRITE1 =
      [[msg.whenSpriteCollided1(), '0'],
       [msg.whenSpriteCollided2(), '1'],
       [msg.whenSpriteCollided3(), '2'],
       [msg.whenSpriteCollided4(), '3'],
       [msg.whenSpriteCollided5(), '4'],
       [msg.whenSpriteCollided6(), '5']];

  blockly.Blocks.studio_whenSpriteCollided.SPRITE2 =
      [[msg.whenSpriteCollidedWith1(), '0'],
       [msg.whenSpriteCollidedWith2(), '1'],
       [msg.whenSpriteCollidedWith3(), '2'],
       [msg.whenSpriteCollidedWith4(), '3'],
       [msg.whenSpriteCollidedWith5(), '4'],
       [msg.whenSpriteCollidedWith6(), '5']];

  generator.studio_whenSpriteCollided = generator.studio_eventHandlerPrologue;

  blockly.Blocks.studio_stop = {
    // Block for stopping the movement of a sprite.
    helpUrl: '',
    init: function() {
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.stopSprite());
      }
      this.setPreviousStatement(true);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.stopTooltip());
    }
  };

  blockly.Blocks.studio_stop.SPRITE =
      [[msg.stopSprite1(), '0'],
       [msg.stopSprite2(), '1'],
       [msg.stopSprite3(), '2'],
       [msg.stopSprite4(), '3'],
       [msg.stopSprite5(), '4'],
       [msg.stopSprite6(), '5']];

  generator.studio_stop = function() {
    // Generate JavaScript for stopping the movement of a sprite.
    return 'Studio.stop(\'block_id_' + this.id + '\', ' +
        (this.getTitleValue('SPRITE') || '0') + ');\n';
  };

  blockly.Blocks.studio_setSpritePosition = {
    // Block for jumping a sprite to different position.
    helpUrl: '',
    init: function() {
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]); // default to top-left
      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.setSprite());
      }
      this.appendDummyInput()
        .appendTitle(dropdown, 'VALUE');
      this.setPreviousStatement(true);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setSpritePositionTooltip());
    }
  };

  blockly.Blocks.studio_setSpritePosition.SPRITE =
      [[msg.setSprite1(), '0'],
       [msg.setSprite2(), '1'],
       [msg.setSprite3(), '2'],
       [msg.setSprite4(), '3'],
       [msg.setSprite5(), '4'],
       [msg.setSprite6(), '5']];

  blockly.Blocks.studio_setSpritePosition.VALUES =
      [[msg.positionRandom(), 'random'],
       [msg.positionTopLeft(), Position.TOPLEFT.toString()],
       [msg.positionTopCenter(), Position.TOPCENTER.toString()],
       [msg.positionTopRight(), Position.TOPRIGHT.toString()],
       [msg.positionMiddleLeft(), Position.MIDDLELEFT.toString()],
       [msg.positionMiddleCenter(), Position.MIDDLECENTER.toString()],
       [msg.positionMiddleRight(), Position.MIDDLERIGHT.toString()],
       [msg.positionBottomLeft(), Position.BOTTOMLEFT.toString()],
       [msg.positionBottomCenter(), Position.BOTTOMCENTER.toString()],
       [msg.positionBottomRight(), Position.BOTTOMRIGHT.toString()]];

  generator.studio_setSpritePosition = function() {
    return generateSetterCode({
      ctx: this,
      extraParams: (this.getTitleValue('SPRITE') || '0'),
      name: 'setSpritePosition'});
  };

  blockly.Blocks.studio_move = {
    // Block for moving one frame a time.
    helpUrl: '',
    init: function() {
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
        this.appendDummyInput()
          .appendTitle('\t');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.moveSprite());
      }
      this.appendDummyInput()
        .appendTitle(new blockly.FieldDropdown(this.DIR), 'DIR');
      this.setPreviousStatement(true);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.moveTooltip());
    }
  };

  blockly.Blocks.studio_move.SPRITE =
      [[msg.moveSprite1(), '0'],
       [msg.moveSprite2(), '1'],
       [msg.moveSprite3(), '2'],
       [msg.moveSprite4(), '3'],
       [msg.moveSprite5(), '4'],
       [msg.moveSprite6(), '5']];

  blockly.Blocks.studio_move.DIR =
      [[msg.moveDirectionUp(), Direction.NORTH.toString()],
       [msg.moveDirectionDown(), Direction.SOUTH.toString()],
       [msg.moveDirectionLeft(), Direction.WEST.toString()],
       [msg.moveDirectionRight(), Direction.EAST.toString()]];

  generator.studio_move = function() {
    // Generate JavaScript for moving.
    return 'Studio.move(\'block_id_' + this.id + '\', ' +
        (this.getTitleValue('SPRITE') || '0') + ', ' +
        this.getTitleValue('DIR') + ');\n';
  };

  var initMoveDistanceBlock = function (block) {
    // Block for moving/gliding a specific distance.
    block.helpUrl = '';
    block.init = function() {
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
        this.appendDummyInput()
          .appendTitle('\t');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.moveSprite());
      }
      this.appendDummyInput()
        .appendTitle(new blockly.FieldDropdown(this.DIR), 'DIR');
      this.appendDummyInput()
        .appendTitle('\t');
      if (block.params) {
        this.appendValueInput('DISTANCE')
          .setCheck('Number');
        this.appendDummyInput()
          .appendTitle(msg.moveDistancePixels());
      } else {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.DISTANCE), 'DISTANCE');
      }
      this.setPreviousStatement(true);
      this.setInputsInline(true);
      this.setNextStatement(true);
      this.setTooltip(msg.moveDistanceTooltip());
    };

    block.SPRITE =
      [[msg.moveSprite1(), '0'],
       [msg.moveSprite2(), '1'],
       [msg.moveSprite3(), '2'],
       [msg.moveSprite4(), '3'],
       [msg.moveSprite5(), '4'],
       [msg.moveSprite6(), '5']];

    block.DIR =
        [[msg.moveDirectionUp(), Direction.NORTH.toString()],
         [msg.moveDirectionDown(), Direction.SOUTH.toString()],
         [msg.moveDirectionLeft(), Direction.WEST.toString()],
         [msg.moveDirectionRight(), Direction.EAST.toString()],
         [msg.moveDirectionRandom(), 'random']];

    if (!block.params) {
      block.DISTANCE =
          [[msg.moveDistance25(), '25'],
           [msg.moveDistance50(), '50'],
           [msg.moveDistance100(), '100'],
           [msg.moveDistance200(), '200'],
           [msg.moveDistance400(), '400'],
           [msg.moveDistanceRandom(), 'random']];
    }
  };

  blockly.Blocks.studio_moveDistance = {};
  initMoveDistanceBlock(blockly.Blocks.studio_moveDistance);
  blockly.Blocks.studio_moveDistanceParams = { 'params': true };
  initMoveDistanceBlock(blockly.Blocks.studio_moveDistanceParams);

  generator.studio_moveDistance = function() {
    // Generate JavaScript for moving.

    var allDistances = this.DISTANCE.slice(0, -1).map(function (item) {
      return item[1];
    });
    var distParam = this.getTitleValue('DISTANCE');
    if (distParam === 'random') {
      distParam = 'Studio.random([' + allDistances + '])';
    }
    var allDirections = this.DIR.slice(0, -1).map(function (item) {
      return item[1];
    });
    var dirParam = this.getTitleValue('DIR');
    if (dirParam === 'random') {
      dirParam = 'Studio.random([' + allDirections + '])';
    }

    return 'Studio.moveDistance(\'block_id_' + this.id +
        '\', ' +
        (this.getTitleValue('SPRITE') || '0') + ', ' +
        dirParam + ', ' +
        distParam + ');\n';
  };

  generator.studio_moveDistanceParams = function() {
    // Generate JavaScript for moving (params version).

    var allDirections = this.DIR.slice(0, -1).map(function (item) {
      return item[1];
    });
    var dirParam = this.getTitleValue('DIR');
    if (dirParam === 'random') {
      dirParam = 'Studio.random([' + allDirections + '])';
    }
    var distParam = Blockly.JavaScript.valueToCode(this, 'DISTANCE',
        Blockly.JavaScript.ORDER_NONE) || '0';

    return 'Studio.moveDistance(\'block_id_' + this.id +
        '\', ' +
        (this.getTitleValue('SPRITE') || '0') + ', ' +
        dirParam + ', ' +
        distParam + ');\n';
  };

  blockly.Blocks.studio_playSound = {
    // Block for playing sound.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.SOUNDS), 'SOUND');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.playSoundTooltip());
    }
  };

  blockly.Blocks.studio_playSound.SOUNDS =
      [[msg.playSoundHit(), 'hit'],
       [msg.playSoundWood(), 'wood'],
       [msg.playSoundRetro(), 'retro'],
       [msg.playSoundSlap(), 'slap'],
       [msg.playSoundRubber(), 'rubber'],
       [msg.playSoundCrunch(), 'crunch'],
       [msg.playSoundWinPoint(), 'winpoint'],
       [msg.playSoundWinPoint2(), 'winpoint2'],
       [msg.playSoundLosePoint(), 'losepoint'],
       [msg.playSoundLosePoint2(), 'losepoint2'],
       [msg.playSoundGoal1(), 'goal1'],
       [msg.playSoundGoal2(), 'goal2']];

  generator.studio_playSound = function() {
    // Generate JavaScript for playing a sound.
    return 'Studio.playSound(\'block_id_' + this.id + '\', \'' +
               this.getTitleValue('SOUND') + '\');\n';
  };

  blockly.Blocks.studio_incrementScore = {
    // Block for incrementing the score.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(new blockly.FieldDropdown(this.PLAYERS), 'PLAYER');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.incrementScoreTooltip());
    }
  };

  blockly.Blocks.studio_incrementScore.PLAYERS =
      [[msg.incrementPlayerScore(), 'player'],
       [msg.incrementOpponentScore(), 'opponent']];

  generator.studio_incrementScore = function() {
    // Generate JavaScript for incrementing the score.
    return 'Studio.incrementScore(\'block_id_' + this.id + '\', \'' +
                this.getTitleValue('PLAYER') + '\');\n';
  };

  blockly.Blocks.studio_setScoreText = {
    // Block for setting the score text.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendValueInput('TEXT')
        .setCheck('String')
        .appendTitle(msg.setScoreText());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setScoreTextTooltip());
    }
  };

  generator.studio_setScoreText = function() {
    // Generate JavaScript for setting the score text.
    var arg = Blockly.JavaScript.valueToCode(this, 'TEXT',
        Blockly.JavaScript.ORDER_NONE) || '';
    return 'Studio.setScoreText(\'block_id_' + this.id + '\', ' + arg + ');\n';
  };

  blockly.Blocks.studio_setSpriteSpeed = {
    // Block for setting sprite speed
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]); // default to normal

      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);

      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.setSprite());
      }
      this.appendDummyInput()
        .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setSpriteSpeedTooltip());
    }
  };

  blockly.Blocks.studio_setSpriteSpeed.VALUES =
      [[msg.setSpriteSpeedRandom(), 'random'],
       [msg.setSpriteSpeedVerySlow(), 'Studio.SpriteSpeed.VERY_SLOW'],
       [msg.setSpriteSpeedSlow(), 'Studio.SpriteSpeed.SLOW'],
       [msg.setSpriteSpeedNormal(), 'Studio.SpriteSpeed.NORMAL'],
       [msg.setSpriteSpeedFast(), 'Studio.SpriteSpeed.FAST'],
       [msg.setSpriteSpeedVeryFast(), 'Studio.SpriteSpeed.VERY_FAST']];

  blockly.Blocks.studio_setSpriteSpeed.SPRITE =
      [[msg.setSprite1(), '0'],
       [msg.setSprite2(), '1'],
       [msg.setSprite3(), '2'],
       [msg.setSprite4(), '3'],
       [msg.setSprite5(), '4'],
       [msg.setSprite6(), '5']];

  generator.studio_setSpriteSpeed = function () {
    return generateSetterCode({
      ctx: this,
      extraParams: (this.getTitleValue('SPRITE') || '0'),
      name: 'setSpriteSpeed'});
  };

  /**
   * setBackground
   */
  blockly.Blocks.studio_setBackground = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to cave

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setBackgroundTooltip());
    }
  };

  blockly.Blocks.studio_setBackground.VALUES =
      [[msg.setBackgroundRandom(), 'random'],
       [msg.setBackgroundCave(), '"cave"'],
       [msg.setBackgroundNight(), '"night"'],
       [msg.setBackgroundCloudy(), '"cloudy"'],
       [msg.setBackgroundUnderwater(), '"underwater"'],
       [msg.setBackgroundHardcourt(), '"hardcourt"'],
       [msg.setBackgroundBlack(), '"black"']];

  generator.studio_setBackground = function() {
    return generateSetterCode({ctx: this, name: 'setBackground'});
  };

  /**
   * showTitleScreen
   */
  var initShowTitleScreenBlock = function (block) {
    block.helpUrl = '';
    block.init = function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.showTitleScreen());
      if (block.params) {
        this.appendValueInput('TITLE')
          .setCheck('String')
          .setAlign(Blockly.ALIGN_RIGHT)
          .appendTitle(msg.showTitleScreenTitle());
        this.appendValueInput('TEXT')
          .setCheck('String')
          .setAlign(Blockly.ALIGN_RIGHT)
          .appendTitle(msg.showTitleScreenText());
      } else {
        this.appendDummyInput()
          .appendTitle(msg.showTitleScreenTitle())
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote0.png'), 12, 12))
          .appendTitle(new Blockly.FieldTextInput(
              msg.showTSDefTitle()),
              'TITLE')
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote1.png'), 12, 12));
        this.appendDummyInput()
          .appendTitle(msg.showTitleScreenText())
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote0.png'), 12, 12))
          .appendTitle(new Blockly.FieldTextInput(msg.showTSDefText()), 'TEXT')
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote1.png'), 12, 12));
      }
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.showTitleScreenTooltip());
    };
  };

  blockly.Blocks.studio_showTitleScreen = {};
  initShowTitleScreenBlock(blockly.Blocks.studio_showTitleScreen);
  blockly.Blocks.studio_showTitleScreenParams = { 'params': true };
  initShowTitleScreenBlock(blockly.Blocks.studio_showTitleScreenParams);

  generator.studio_showTitleScreen = function() {
    // Generate JavaScript for showing title screen.
    return 'Studio.showTitleScreen(\'block_id_' + this.id +
               '\', ' +
               blockly.JavaScript.quote_(this.getTitleValue('TITLE')) + ', ' +
               blockly.JavaScript.quote_(this.getTitleValue('TEXT')) + ');\n';
  };

  generator.studio_showTitleScreenParams = function() {
    // Generate JavaScript for showing title screen (param version).
    var titleParam = Blockly.JavaScript.valueToCode(this, 'TITLE',
        Blockly.JavaScript.ORDER_NONE) || '';
    var textParam = Blockly.JavaScript.valueToCode(this, 'TEXT',
        Blockly.JavaScript.ORDER_NONE) || '';
    return 'Studio.showTitleScreen(\'block_id_' + this.id +
               '\', ' + titleParam + ', ' + textParam + ');\n';
  };

  if (isK1) {
    /**
     * setSprite (K1 version: only sets visible/hidden)
     */
    blockly.Blocks.studio_setSprite = {
      helpUrl: '',
      init: function() {
        var dropdown = new blockly.FieldDropdown(this.VALUES);
        dropdown.setValue(this.VALUES[1][1]);  // default to visible

        var dropdownArray =
            this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);

        this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
        this.setHSV(312, 0.32, 0.62);
        if (blockly.Blocks.studio_spriteCount > 1) {
          this.appendDummyInput()
            .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
        }
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(msg.setSpriteK1Tooltip());
      }
    };

    blockly.Blocks.studio_setSprite.SPRITE =
        [[msg.sprite1(), '0'],
         [msg.sprite2(), '1'],
         [msg.sprite3(), '2'],
         [msg.sprite4(), '3'],
         [msg.sprite5(), '4'],
         [msg.sprite6(), '5']];

    blockly.Blocks.studio_setSprite.VALUES =
        [[msg.setSpriteHideK1(), '"hidden"'],
         [msg.setSpriteShowK1(), '"visible"']];
  } else {
    /**
     * setSprite
     */
    blockly.Blocks.studio_setSprite = {
      helpUrl: '',
      init: function() {
        var dropdown = new blockly.FieldDropdown(this.VALUES);
        dropdown.setValue(this.VALUES[2][1]);  // default to witch

        var dropdownArray =
            this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);

        this.setHSV(312, 0.32, 0.62);
        if (blockly.Blocks.studio_spriteCount > 1) {
          this.appendDummyInput()
            .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
        } else {
          this.appendDummyInput()
            .appendTitle(msg.setSprite());
        }
        this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
        this.setInputsInline(true);
        this.setPreviousStatement(true);
        this.setNextStatement(true);
        this.setTooltip(msg.setSpriteTooltip());
      }
    };

    blockly.Blocks.studio_setSprite.SPRITE =
        [[msg.setSprite1(), '0'],
         [msg.setSprite2(), '1'],
         [msg.setSprite3(), '2'],
         [msg.setSprite4(), '3'],
         [msg.setSprite5(), '4'],
         [msg.setSprite6(), '5']];

    blockly.Blocks.studio_setSprite.VALUES =
        [[msg.setSpriteHidden(), '"hidden"'],
         [msg.setSpriteRandom(), 'random'],
         [msg.setSpriteWitch(), '"witch"'],
         [msg.setSpriteCat(), '"cat"'],
         [msg.setSpriteDinosaur(), '"dinosaur"'],
         [msg.setSpriteDog(), '"dog"'],
         [msg.setSpriteOctopus(), '"octopus"'],
         [msg.setSpritePenguin(), '"penguin"']];
  }

  generator.studio_setSprite = function() {
    var value = this.getTitleValue('VALUE');
    var indexString = this.getTitleValue('SPRITE') || '0';
    if (!blockly.Blocks.studio_firstSetSprite &&
        'random' !== value &&
        '"hidden"' !== value) {
      // Store the params for the first non-random, non-hidden setSprite
      // call so we can auto-reference this sprite in showTitleScreen() later
      blockly.Blocks.studio_firstSetSprite = {
        'index': parseInt(indexString, 10),
        'value': value.replace(/^"+|"+$/g, ''), // remove quotes
      };
    }
    return generateSetterCode({
      ctx: this,
      random: 1, // random may not be present for K1 block, but that's harmless
      extraParams: indexString,
      name: 'setSprite'});
  };

  blockly.Blocks.studio_setSpriteEmotion = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to normal

      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);

      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.setSprite());
      }
      this.appendDummyInput()
        .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setSpriteEmotionTooltip());
    }
  };

  blockly.Blocks.studio_setSpriteEmotion.SPRITE =
      [[msg.setSprite1(), '0'],
       [msg.setSprite2(), '1'],
       [msg.setSprite3(), '2'],
       [msg.setSprite4(), '3'],
       [msg.setSprite5(), '4'],
       [msg.setSprite6(), '5']];

  blockly.Blocks.studio_setSpriteEmotion.VALUES =
      [[msg.setSpriteEmotionRandom(), 'random'],
       [msg.setSpriteEmotionNormal(), Emotions.NORMAL.toString()],
       [msg.setSpriteEmotionHappy(), Emotions.HAPPY.toString()],
       [msg.setSpriteEmotionAngry(), Emotions.ANGRY.toString()],
       [msg.setSpriteEmotionSad(), Emotions.SAD.toString()]];

  generator.studio_setSpriteEmotion = function() {
    return generateSetterCode({
      ctx: this,
      extraParams: (this.getTitleValue('SPRITE') || '0'),
      name: 'setSpriteEmotion'});
  };

  var initSayBlock = function (block) {
    // Block for waiting a specific amount of time.
    block.helpUrl = '';
    block.init = function() {
      var dropdownArray =
          this.SPRITE.slice(0, blockly.Blocks.studio_spriteCount);
      this.setHSV(184, 1.00, 0.74);
      if (blockly.Blocks.studio_spriteCount > 1) {
        this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(dropdownArray), 'SPRITE');
      } else {
        this.appendDummyInput()
          .appendTitle(msg.saySprite());
      }
      if (block.params) {
        this.appendValueInput('TEXT')
          .setCheck('String');
      } else {
        this.appendDummyInput()
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote0.png'), 12, 12))
          .appendTitle(new Blockly.FieldTextInput(msg.defaultSayText()), 'TEXT')
          .appendTitle(new Blockly.FieldImage(
                  Blockly.assetUrl('media/quote1.png'), 12, 12));
      }
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.saySpriteTooltip());
    };

    block.SPRITE =
        [[msg.saySprite1(), '0'],
         [msg.saySprite2(), '1'],
         [msg.saySprite3(), '2'],
         [msg.saySprite4(), '3'],
         [msg.saySprite5(), '4'],
         [msg.saySprite6(), '5']];
  };

  blockly.Blocks.studio_saySprite = {};
  initSayBlock(blockly.Blocks.studio_saySprite);
  blockly.Blocks.studio_saySpriteParams = { 'params': true };
  initSayBlock(blockly.Blocks.studio_saySpriteParams);

  generator.studio_saySprite = function() {
    // Generate JavaScript for saying.
    return 'Studio.saySprite(\'block_id_' + this.id +
               '\', ' +
               (this.getTitleValue('SPRITE') || '0') + ', ' +
               blockly.JavaScript.quote_(this.getTitleValue('TEXT')) + ');\n';
  };

  generator.studio_saySpriteParams = function() {
    // Generate JavaScript for saying (param version).
    var textParam = Blockly.JavaScript.valueToCode(this, 'TEXT',
        Blockly.JavaScript.ORDER_NONE) || '';
    return 'Studio.saySprite(\'block_id_' + this.id +
               '\', ' +
               (this.getTitleValue('SPRITE') || '0') + ', ' +
               textParam + ');\n';
  };
  
  var initWaitBlock = function (block) {
    // Block for waiting a specific amount of time.
    block.helpUrl = '';
    block.init = function() {
      this.setHSV(184, 1.00, 0.74);
      if (block.params) {
        this.appendDummyInput()
          .appendTitle(msg.waitFor());
        this.appendValueInput('VALUE')
          .setCheck('Number');
        this.appendDummyInput()
          .appendTitle(msg.waitSeconds());
      } else {
        var dropdown = new blockly.FieldDropdown(this.VALUES);
        dropdown.setValue(this.VALUES[2][1]);  // default to half second

        this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      }
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(block.params ?
                        msg.waitParamsTooltip() :
                        msg.waitTooltip());
    };

    if (!block.params) {
      block.VALUES =
        [[msg.waitForClick(), '0'],
         [msg.waitForRandom(), 'random'],
         [msg.waitForHalfSecond(), '500'],
         [msg.waitFor1Second(), '1000'],
         [msg.waitFor2Seconds(), '2000'],
         [msg.waitFor5Seconds(), '5000'],
         [msg.waitFor10Seconds(), '10000']];
    }
  };

  blockly.Blocks.studio_wait = {};
  initWaitBlock(blockly.Blocks.studio_wait);
  blockly.Blocks.studio_waitParams = { 'params': true };
  initWaitBlock(blockly.Blocks.studio_waitParams);

  generator.studio_wait = function() {
    return generateSetterCode({
      ctx: this,
      random: 1,
      name: 'wait'});
  };

  generator.studio_waitParams = function() {
    // Generate JavaScript for wait (params version).
    var valueParam = Blockly.JavaScript.valueToCode(this, 'VALUE',
        Blockly.JavaScript.ORDER_NONE) || '0';
    return 'Studio.wait(\'block_id_' + this.id +
        '\', (' + valueParam + ' * 1000));\n';
  };

};

},{"../../locale/pt_pt/studio":37,"../codegen":6,"./tiles":21}],15:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/studio') ; buf.push('\n\n<td id="soft-buttons" class="soft-buttons-none">\n  <button id="leftButton" class="arrow">\n    <img src="', escape((5,  assetUrl('media/1x1.gif') )), '" class="left-btn icon21">\n  <button id="rightButton" class="arrow">\n    <img src="', escape((7,  assetUrl('media/1x1.gif') )), '" class="right-btn icon21">\n  <button id="upButton" class="arrow">\n    <img src="', escape((9,  assetUrl('media/1x1.gif') )), '" class="up-btn icon21">\n  <button id="downButton" class="arrow">\n    <img src="', escape((11,  assetUrl('media/1x1.gif') )), '" class="down-btn icon21">\n</td>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/studio":37,"ejs":38}],16:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/studio') ; buf.push('\n\n<tr>\n  <td id="share-cell" class="share-cell-none">\n    <button id="shareButton" class="share">\n      <img src="', escape((6,  assetUrl('media/1x1.gif') )), '">', escape((6,  msg.share() )), '\n    </button>\n  </td>\n</tr>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/studio":37,"ejs":38}],17:[function(require,module,exports){
/*jshint multistr: true */

var msg = require('../../locale/pt_pt/studio');
var utils = require('../utils');
var blockUtils = require('../block_utils');
var tiles = require('./tiles');
var Direction = tiles.Direction;
var Emotions = tiles.Emotions;
var tb = blockUtils.createToolbox;
var blockOfType = blockUtils.blockOfType;
var createCategory = blockUtils.createCategory;

/*
 * Configuration for all levels.
 */
module.exports = {

  '1': {
    'requiredBlocks': [
      [{'test': 'saySprite', 'type': 'studio_saySprite'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 16,0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'goal': {
      successCondition: function () {
        return (Studio.sayComplete > 0);
      }
    },
    'timeoutFailureTick': 100,
    'toolbox':
      tb('<block type="studio_moveDistance"><title name="DIR">2</title></block>' +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '2': {
    'requiredBlocks': [
      [{'test': 'moveDistance', 'type': 'studio_moveDistance'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0,16, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'timeoutFailureTick': 100,
    'toolbox':
      tb('<block type="studio_moveDistance"><title name="DIR">2</title></block>' +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '3': {
    'requiredBlocks': [
      [{'test': 'moveDistance', 'type': 'studio_moveDistance'}],
      [{'test': 'saySprite', 'type': 'studio_saySprite'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0,16, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'goal': {
      successCondition: function () {
        return ((Studio.sayComplete > 0) &&
                (Studio.sprite[0].collisionMask & 2));
      }
    },
    'timeoutFailureTick': 200,
    'toolbox':
      tb('<block type="studio_moveDistance"><title name="DIR">2</title></block>' +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block> \
      <block type="studio_whenSpriteCollided" deletable="false" x="20" y="120"></block>'
  },
  '4': {
    'requiredBlocks': [
      [{'test': 'move', 'type': 'studio_move'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0,16, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 2,
    'toolbox':
      tb(blockOfType('studio_move') +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_whenLeft" deletable="false" x="20" y="20"></block> \
      <block type="studio_whenRight" deletable="false" x="180" y="20"></block> \
      <block type="studio_whenUp" deletable="false" x="20" y="120"></block> \
      <block type="studio_whenDown" deletable="false" x="180" y="120"></block>'
  },
  '5': {
    'requiredBlocks': [
      [{'test': 'moveDistance', 'type': 'studio_moveDistance'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0,16, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 3,
    'timeoutFailureTick': 200,
    'toolbox':
      tb(blockOfType('studio_moveDistance') +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_repeatForever" deletable="false" x="20" y="20"></block>'
  },
  '6': {
    'requiredBlocks': [
      [{'test': 'move', 'type': 'studio_move'}],
      [{'test': 'saySprite', 'type': 'studio_saySprite'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [16,0, 0, 0,16, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 2,
    'toolbox':
      tb(blockOfType('studio_moveDistance') +
         blockOfType('studio_move') +
         blockOfType('studio_saySprite')),
    'minWorkspaceHeight': 600,
    'startBlocks':
     '<block type="studio_whenLeft" deletable="false" x="20" y="20"> \
        <next><block type="studio_move"> \
                <title name="DIR">8</title></block> \
        </next></block> \
      <block type="studio_whenRight" deletable="false" x="20" y="100"> \
        <next><block type="studio_move"> \
                <title name="DIR">2</title></block> \
        </next></block> \
      <block type="studio_whenUp" deletable="false" x="20" y="180"> \
        <next><block type="studio_move"> \
                <title name="DIR">1</title></block> \
        </next></block> \
      <block type="studio_whenDown" deletable="false" x="20" y="260"> \
        <next><block type="studio_move"> \
                <title name="DIR">4</title></block> \
        </next></block> \
      <block type="studio_repeatForever" deletable="false" x="20" y="340"> \
        <statement name="DO"><block type="studio_moveDistance"> \
                <title name="SPRITE">1</title> \
                <title name="DISTANCE">400</title> \
          <next><block type="studio_moveDistance"> \
                  <title name="SPRITE">1</title> \
                  <title name="DISTANCE">400</title> \
                  <title name="DIR">4</title></block> \
          </next></block> \
      </statement></block> \
      <block type="studio_whenSpriteCollided" deletable="false" x="20" y="450"></block>'
  },
  '7': {
    'requiredBlocks': [
      [{'test': 'saySprite', 'type': 'studio_saySprite'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0,16, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'goal': {
      successCondition: function () {
        return (Studio.sayComplete > 1);
      }
    },
    'timeoutFailureTick': 200,
    'toolbox':
      tb('<block type="studio_moveDistance"><title name="DIR">2</title></block>' +
         blockOfType('studio_saySprite')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '8': {
    'requiredBlocks': [
      [{'test': 'setSpriteEmotion', 'type': 'studio_setSpriteEmotion'}]
    ],
    'scale': {
      'snapRadius': 2
    },
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 16,0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 4,
    'goal': {
      successCondition: function () {
        return (Studio.sprite[0].emotion === Emotions.HAPPY) &&
               (Studio.tickCount >= 50);
      }
    },
    'timeoutFailureTick': 100,
    'toolbox':
      tb('<block type="studio_moveDistance"><title name="DIR">2</title></block>' +
         blockOfType('studio_setSpriteEmotion')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '9': {
    'requiredBlocks': [
      [{'test': 'moveDistance', 'type': 'studio_moveDistance'}],
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'map': [
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [16,0, 0, 0,16, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 2,
    'spriteFinishIndex': 1,
    'timeoutFailureTick': 150,
    'minWorkspaceHeight': 500,
    'toolbox':
      tb('<block type="studio_moveDistance"> \
           <title name="DISTANCE">400</title> \
           <title name="SPRITE">1</title></block>' +
         '<block type="studio_saySprite"> \
           <title name="SPRITE">1</title></block>'),
    'startBlocks':
     '<block type="studio_whenLeft" deletable="false" x="20" y="20"> \
        <next><block type="studio_move"> \
                <title name="DIR">8</title></block> \
        </next></block> \
      <block type="studio_whenRight" deletable="false" x="20" y="100"> \
        <next><block type="studio_move"> \
                <title name="DIR">2</title></block> \
        </next></block> \
      <block type="studio_whenUp" deletable="false" x="20" y="180"> \
        <next><block type="studio_move"> \
                <title name="DIR">1</title></block> \
        </next></block> \
      <block type="studio_whenDown" deletable="false" x="20" y="260"> \
        <next><block type="studio_move"> \
                <title name="DIR">4</title></block> \
        </next></block> \
      <block type="studio_repeatForever" deletable="false" x="20" y="340"></block>'
  },
  '10': {
    'requiredBlocks': [
      [{'test': 'playSound', 'type': 'studio_playSound'}],
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'map': [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [16,0, 0, 0,16, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'spriteStartingImage': 2,
    'spriteFinishIndex': 1,
    'minWorkspaceHeight': 600,
    'goal': {
      successCondition: function () {
        return (Studio.playSoundCount > 0) &&
               (Studio.tickCount >= 120);
      }
    },
    'timeoutFailureTick': 300,
    'toolbox':
      tb('<block type="studio_moveDistance"> \
           <title name="DISTANCE">400</title> \
           <title name="SPRITE">1</title></block>' +
         '<block type="studio_saySprite"> \
           <title name="SPRITE">1</title></block>' +
         '<block type="studio_playSound"> \
           <title name="SOUND">crunch</title></block>'),
    'startBlocks':
     '<block type="studio_whenLeft" deletable="false" x="20" y="20"> \
        <next><block type="studio_move"> \
                <title name="DIR">8</title></block> \
        </next></block> \
      <block type="studio_whenRight" deletable="false" x="20" y="100"> \
        <next><block type="studio_move"> \
                <title name="DIR">2</title></block> \
        </next></block> \
      <block type="studio_whenUp" deletable="false" x="20" y="180"> \
        <next><block type="studio_move"> \
                <title name="DIR">1</title></block> \
        </next></block> \
      <block type="studio_whenDown" deletable="false" x="20" y="260"> \
        <next><block type="studio_move"> \
                <title name="DIR">4</title></block> \
        </next></block> \
      <block type="studio_repeatForever" deletable="false" x="20" y="340"> \
        <statement name="DO"><block type="studio_moveDistance"> \
                <title name="SPRITE">1</title> \
                <title name="DISTANCE">400</title> \
          <next><block type="studio_moveDistance"> \
                  <title name="SPRITE">1</title> \
                  <title name="DISTANCE">400</title> \
                  <title name="DIR">4</title></block> \
          </next></block> \
      </statement></block> \
      <block type="studio_whenSpriteCollided" deletable="false" x="20" y="450"></block>'
  },
  '13': {
    'requiredBlocks': [
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'minWorkspaceHeight': 1000,
    'spritesHiddenToStart': true,
    'freePlay': true,
    'map': [
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'toolbox':
      tb(blockOfType('studio_setSprite') +
         blockOfType('studio_setBackground') +
         blockOfType('studio_whenGameStarts') +
         blockOfType('studio_whenLeft') +
         blockOfType('studio_whenRight') +
         blockOfType('studio_whenUp') +
         blockOfType('studio_whenDown') +
         blockOfType('studio_whenSpriteCollided') +
         blockOfType('studio_repeatForever') +
         blockOfType('studio_move') +
         blockOfType('studio_moveDistance') +
         blockOfType('studio_playSound') +
         blockOfType('studio_incrementScore') +
         blockOfType('studio_saySprite') +
         blockOfType('studio_setSpriteSpeed') +
         blockOfType('studio_setSpriteEmotion')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '99': {
    'requiredBlocks': [
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'minWorkspaceHeight': 1300,
    'spritesHiddenToStart': true,
    'freePlay': true,
    'map': [
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'toolbox':
      tb(blockOfType('studio_setSprite') +
         blockOfType('studio_setBackground') +
         blockOfType('studio_whenGameStarts') +
         blockOfType('studio_whenLeft') +
         blockOfType('studio_whenRight') +
         blockOfType('studio_whenUp') +
         blockOfType('studio_whenDown') +
         blockOfType('studio_whenSpriteClicked') +
         blockOfType('studio_whenSpriteCollided') +
         blockOfType('studio_repeatForever') +
         blockOfType('studio_showTitleScreen') +
         blockOfType('studio_move') +
         blockOfType('studio_moveDistance') +
         blockOfType('studio_stop') +
         blockOfType('studio_wait') +
         blockOfType('studio_playSound') +
         blockOfType('studio_incrementScore') +
         blockOfType('studio_saySprite') +
         blockOfType('studio_setSpritePosition') +
         blockOfType('studio_setSpriteSpeed') +
         blockOfType('studio_setSpriteEmotion')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
  '100': {
    'requiredBlocks': [
    ],
    'scale': {
      'snapRadius': 2
    },
    'softButtons': [
      'leftButton',
      'rightButton',
      'downButton',
      'upButton'
    ],
    'minWorkspaceHeight': 1000,
    'spritesHiddenToStart': true,
    'freePlay': true,
    'map': [
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0,16, 0, 0, 0,16, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0]
    ],
    'toolbox':
      tb(createCategory(msg.catActions(),
                          blockOfType('studio_setSprite') +
                          blockOfType('studio_setBackground') +
                        '<block type="studio_showTitleScreenParams"> \
                          <value name="TITLE"><block type="text"></block> \
                          </value> \
                          <value name="TEXT"><block type="text"></block> \
                          </value></block>' +
                          blockOfType('studio_move') +
                      '<block type="studio_moveDistanceParams" inline="true"> \
                        <value name="DISTANCE"><block type="math_number"> \
                                <title name="NUM">25</title></block> \
                        </value></block>' +
                          blockOfType('studio_stop') +
                        '<block type="studio_waitParams" inline="true"> \
                          <value name="VALUE"><block type="math_number"> \
                                  <title name="NUM">1</title></block> \
                          </value></block>' +
                          blockOfType('studio_playSound') +
                        '<block type="studio_setScoreText" inline="true"> \
                          <value name="TEXT"><block type="text"></block> \
                          </value></block>' +
                        '<block type="studio_saySpriteParams" inline="true"> \
                          <value name="TEXT"><block type="text"></block> \
                          </value></block>' +
                          blockOfType('studio_setSpritePosition') +
                          blockOfType('studio_setSpriteSpeed') +
                          blockOfType('studio_setSpriteEmotion')) +
         createCategory(msg.catEvents(),
                          blockOfType('studio_whenGameStarts') +
                          blockOfType('studio_whenLeft') +
                          blockOfType('studio_whenRight') +
                          blockOfType('studio_whenUp') +
                          blockOfType('studio_whenDown') +
                          blockOfType('studio_whenSpriteClicked') +
                          blockOfType('studio_whenSpriteCollided')) +
         createCategory(msg.catControl(),
                          blockOfType('studio_repeatForever') +
                         '<block type="controls_repeat_ext"> \
                            <value name="TIMES"> \
                              <block type="math_number"> \
                                <title name="NUM">10</title> \
                              </block> \
                            </value> \
                          </block>' +
                          blockOfType('controls_whileUntil') +
                         '<block type="controls_for"> \
                            <value name="FROM"> \
                              <block type="math_number"> \
                                <title name="NUM">1</title> \
                              </block> \
                            </value> \
                            <value name="TO"> \
                              <block type="math_number"> \
                                <title name="NUM">10</title> \
                              </block> \
                            </value> \
                            <value name="BY"> \
                              <block type="math_number"> \
                                <title name="NUM">1</title> \
                              </block> \
                            </value> \
                          </block>' +
                          blockOfType('controls_flow_statements')) +
         createCategory(msg.catLogic(),
                          blockOfType('controls_if') +
                          blockOfType('logic_compare') +
                          blockOfType('logic_operation') +
                          blockOfType('logic_negate') +
                          blockOfType('logic_boolean')) +
         createCategory(msg.catMath(),
                          blockOfType('math_number') +
                         '<block type="math_change"> \
                            <value name="DELTA"> \
                              <block type="math_number"> \
                                <title name="NUM">1</title> \
                              </block> \
                            </value> \
                          </block>' +
                         '<block type="math_random_int"> \
                            <value name="FROM"> \
                              <block type="math_number"> \
                                <title name="NUM">1</title> \
                              </block> \
                            </value> \
                            <value name="TO"> \
                              <block type="math_number"> \
                                <title name="NUM">100</title> \
                              </block> \
                            </value> \
                          </block>' +
                          blockOfType('math_arithmetic')) +
         createCategory(msg.catText(),
                          blockOfType('text') +
                          blockOfType('text_join') +
                         '<block type="text_append"> \
                            <value name="TEXT"> \
                              <block type="text"></block> \
                            </value> \
                          </block>') +
         createCategory(msg.catVariables(), '', 'VARIABLE') +
         createCategory(msg.catProcedures(), '', 'PROCEDURE')),
    'startBlocks':
     '<block type="studio_whenGameStarts" deletable="false" x="20" y="20"></block>'
  },
};

// K-1 levels:
module.exports.k1_1 = utils.extend(module.exports['1'],  {'is_k1': true});
module.exports.k1_2 = utils.extend(module.exports['7'],  {'is_k1': true});
module.exports.k1_3 = utils.extend(module.exports['2'],  {'is_k1': true});
module.exports.k1_4 = utils.extend(module.exports['3'],  {'is_k1': true});
module.exports.k1_5 = utils.extend(module.exports['8'],  {'is_k1': true});
module.exports.k1_6 = utils.extend(module.exports['4'],  {'is_k1': true});
module.exports.k1_7 = utils.extend(module.exports['9'],  {'is_k1': true});
module.exports.k1_8 = utils.extend(module.exports['10'], {'is_k1': true});
module.exports.k1_11 = utils.extend(module.exports['13'], {'is_k1': true});

},{"../../locale/pt_pt/studio":37,"../block_utils":3,"../utils":34,"./tiles":21}],18:[function(require,module,exports){
(function (global){
var appMain = require('../appMain');
window.Studio = require('./studio');
if (typeof global !== 'undefined') {
  global.Studio = window.Studio;
}
var blocks = require('./blocks');
var levels = require('./levels');
var skins = require('./skins');

window.studioMain = function(options) {
  options.skinsModule = skins;
  options.blocksModule = blocks;
  appMain(window.Studio, levels, options);
};

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../appMain":1,"./blocks":14,"./levels":17,"./skins":19,"./studio":20}],19:[function(require,module,exports){
/**
 * Load Skin for Studio.
 */
// goal: A 20x34 goal image.
// background: Number of 400x400 background images. Randomly select one if
// specified, otherwise, use background.png.

var skinsBase = require('../skins');

var CONFIGS = {
  studio: {
  }
};

exports.load = function(assetUrl, id) {
  var skin = skinsBase.load(assetUrl, id);
  var config = CONFIGS[skin.id];

  skin.hardcourt = {
    background: skin.assetUrl('background.png'),
  };
  skin.black = {
    background: skin.assetUrl('retro_background.png'),
  };
  skin.cave = {
    background: skin.assetUrl('background_cave.png'),
  };
  skin.night = {
    background: skin.assetUrl('background_santa.png'),
  };
  skin.cloudy = {
    background: skin.assetUrl('background_scifi.png'),
  };
  skin.underwater = {
    background: skin.assetUrl('background_underwater.png'),
  };
  skin.cat = {
    sprite: skin.assetUrl('cat_spritesheet_200px.png'),
    spriteFlags: 28,
  };
  skin.dinosaur = {
    sprite: skin.assetUrl('dinosaur_spritesheet_200px.png'),
    spriteFlags: 28,
  };
  skin.dog = {
    sprite: skin.assetUrl('dog_spritesheet_200px.png'),
    spriteFlags: 28,
  };
  skin.octopus = {
    sprite: skin.assetUrl('octopus_spritesheet_200px.png'),
    spriteFlags: 28,
  };
  skin.penguin = {
    sprite: skin.assetUrl('penguin_spritesheet_200px.png'),
    spriteFlags: 28,
  };

  // Images
  skin.goal = skin.assetUrl('goal.png');
  skin.goalSuccess = skin.assetUrl('goal_success.png');
  skin.sprite = skin.assetUrl('witch_sprite_200px.png');
  skin.spriteFlags = 28; // flags: emotions, animation, turns
  skin.goalAnimation = skin.assetUrl('goal.gif');
  skin.approachingGoalAnimation =
      skin.assetUrl(config.approachingGoalAnimation);
  // Sounds
  skin.rubberSound = [skin.assetUrl('wall.mp3'), skin.assetUrl('wall.ogg')];
  skin.flagSound = [skin.assetUrl('win_goal.mp3'),
                    skin.assetUrl('win_goal.ogg')];
  skin.crunchSound = [skin.assetUrl('wall0.mp3'), skin.assetUrl('wall0.ogg')];
  skin.winPointSound = [skin.assetUrl('1_we_win.mp3'),
                        skin.assetUrl('1_we_win.ogg')];
  skin.winPoint2Sound = [skin.assetUrl('2_we_win.mp3'),
                         skin.assetUrl('2_we_win.ogg')];
  skin.losePointSound = [skin.assetUrl('1_we_lose.mp3'),
                         skin.assetUrl('1_we_lose.ogg')];
  skin.losePoint2Sound = [skin.assetUrl('2_we_lose.mp3'),
                          skin.assetUrl('2_we_lose.ogg')];
  skin.goal1Sound = [skin.assetUrl('1_goal.mp3'), skin.assetUrl('1_goal.ogg')];
  skin.goal2Sound = [skin.assetUrl('2_goal.mp3'), skin.assetUrl('2_goal.ogg')];
  skin.woodSound = [skin.assetUrl('1_paddle_bounce.mp3'),
                    skin.assetUrl('1_paddle_bounce.ogg')];
  skin.retroSound = [skin.assetUrl('2_paddle_bounce.mp3'),
                     skin.assetUrl('2_paddle_bounce.ogg')];
  skin.slapSound = [skin.assetUrl('1_wall_bounce.mp3'),
                    skin.assetUrl('1_wall_bounce.ogg')];
  skin.hitSound = [skin.assetUrl('2_wall_bounce.mp3'),
                   skin.assetUrl('2_wall_bounce.ogg')];
  
  // Settings
  if (config.background !== undefined) {
    var index = Math.floor(Math.random() * config.background);
    skin.background = skin.assetUrl('background' + index + '.png');
  } else {
    skin.background = skin.assetUrl('background.png');
  }
  skin.spriteHeight = config.spriteHeight || 100;
  skin.spriteWidth = config.spriteWidth || 100;
  skin.spriteYOffset = config.spriteYOffset || 0;
  return skin;
};

},{"../skins":11}],20:[function(require,module,exports){
/**
 * Blockly App: Studio
 *
 * Copyright 2014 Code.org
 *
 */

'use strict';

var BlocklyApps = require('../base');
var commonMsg = require('../../locale/pt_pt/common');
var studioMsg = require('../../locale/pt_pt/studio');
var skins = require('../skins');
var tiles = require('./tiles');
var codegen = require('../codegen');
var api = require('./api');
var blocks = require('./blocks');
var page = require('../templates/page.html');
var feedback = require('../feedback.js');
var dom = require('../dom');

var Direction = tiles.Direction;
var NextTurn = tiles.NextTurn;
var SquareType = tiles.SquareType;
var Emotions = tiles.Emotions;

/**
 * Create a namespace for the application.
 */
var Studio = module.exports;

Studio.keyState = {};
Studio.btnState = {};

var ButtonState = {
  UP: 0,
  DOWN: 1
};

var SpriteFlags = {
  EMOTIONS: 4,
  ANIMATION: 8,
  TURNS: 16,
};

var SF_SKINS_MASK =
  SpriteFlags.EMOTIONS | SpriteFlags.ANIMATION | SpriteFlags.TURNS;

var SpriteCounts = {
  NORMAL: 1,
  ANIMATION: 1,
  TURNS: 7,
  EMOTIONS: 3,
};

var ArrowIds = {
  LEFT: 'leftButton',
  UP: 'upButton',
  RIGHT: 'rightButton',
  DOWN: 'downButton'
};

var Keycodes = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40
};

var level;
var skin;
var onSharePage;

/**
 * Milliseconds between each animation frame.
 */
var stepSpeed;

//TODO: Make configurable.
BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = true;

//The number of blocks to show as feedback.
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = 1;

// Default Scalings
Studio.scale = {
  'snapRadius': 1,
  'stepSpeed': 33
};

Studio.TITLE_SCREEN_TIMEOUT = 5000;
var TITLE_SCREEN_TITLE_Y_POSITION = 60; // bottom of title text
var TITLE_SCREEN_TEXT_Y_POSITION = 100; // top of text group
var TITLE_SCREEN_TEXT_SIDE_MARGIN = 20;
var TITLE_SCREEN_TEXT_LINE_HEIGHT = 24;
var TITLE_SCREEN_TEXT_MAX_LINES = 7;
var TITLE_SCREEN_TEXT_TOP_MARGIN = 5;
var TITLE_SCREEN_TEXT_V_PADDING = 15;
var TITLE_SCREEN_TEXT_WIDTH = 360;
var TITLE_SCREEN_TEXT_HEIGHT =
      TITLE_SCREEN_TEXT_TOP_MARGIN + TITLE_SCREEN_TEXT_V_PADDING +
      (TITLE_SCREEN_TEXT_MAX_LINES * TITLE_SCREEN_TEXT_LINE_HEIGHT);

var TITLE_SPRITE_X_POS = 3;
var TITLE_SPRITE_Y_POS = 6;

Studio.SPEECH_BUBBLE_TIMEOUT = 3000;
var SPEECH_BUBBLE_RADIUS = 20;
var SPEECH_BUBBLE_H_OFFSET = 50;
var SPEECH_BUBBLE_PADDING = 5;
var SPEECH_BUBBLE_SIDE_MARGIN = 10;
var SPEECH_BUBBLE_LINE_HEIGHT = 20;
var SPEECH_BUBBLE_MAX_LINES = 4;
var SPEECH_BUBBLE_TOP_MARGIN = 5;
var SPEECH_BUBBLE_WIDTH = 180;
var SPEECH_BUBBLE_HEIGHT = 20 +
      (SPEECH_BUBBLE_MAX_LINES * SPEECH_BUBBLE_LINE_HEIGHT);

var SCORE_TEXT_Y_POSITION = 60; // bottom of text

var twitterOptions = {
  text: studioMsg.shareStudioTwitter(),
  hashtag: "StudioCode"
};

var loadLevel = function() {
  // Load maps.
  Studio.map = level.map;
  Studio.timeoutFailureTick = level.timeoutFailureTick || Infinity;
  Studio.minWorkspaceHeight = level.minWorkspaceHeight;
  Studio.spriteStartingImage = level.spriteStartingImage;
  Studio.spritesHiddenToStart = level.spritesHiddenToStart;
  Studio.softButtons_ = level.softButtons || [];
  Studio.spriteFinishIndex = level.spriteFinishIndex || 0;

  // Override scalars.
  for (var key in level.scale) {
    Studio.scale[key] = level.scale[key];
  }

  // Measure maze dimensions and set sizes.
  // ROWS: Number of tiles down.
  Studio.ROWS = Studio.map.length;
  // COLS: Number of tiles across.
  Studio.COLS = Studio.map[0].length;
  // Pixel height and width of each maze square (i.e. tile).
  Studio.SQUARE_SIZE = 50;
  Studio.SPRITE_HEIGHT = skin.spriteHeight;
  Studio.SPRITE_WIDTH = skin.spriteWidth;
  Studio.SPRITE_Y_OFFSET = skin.spriteYOffset;
  // Height and width of the goal and obstacles.
  Studio.MARKER_HEIGHT = 100;
  Studio.MARKER_WIDTH = 100;

  Studio.MAZE_WIDTH = Studio.SQUARE_SIZE * Studio.COLS;
  Studio.MAZE_HEIGHT = Studio.SQUARE_SIZE * Studio.ROWS;
  Studio.PATH_WIDTH = Studio.SQUARE_SIZE / 3;
};

var drawMap = function() {
  var svg = document.getElementById('svgStudio');
  var i, x, y, k;

  // Adjust outer element size.
  svg.setAttribute('width', Studio.MAZE_WIDTH);
  svg.setAttribute('height', Studio.MAZE_HEIGHT);

  // Attach click handler.
  dom.addMouseDownTouchEvent(svg, Studio.onSvgClicked);

  // Adjust visualization and belowVisualization width.
  var visualization = document.getElementById('visualization');
  visualization.style.width = Studio.MAZE_WIDTH + 'px';
  var belowVisualization = document.getElementById('belowVisualization');
  belowVisualization.style.width = Studio.MAZE_WIDTH + 'px';
  if (!BlocklyApps.noPadding &&
      (Studio.minWorkspaceHeight > Studio.MAZE_HEIGHT)) {
    belowVisualization.style.minHeight =
      (Studio.minWorkspaceHeight - Studio.MAZE_HEIGHT) + 'px';
  }

  // Adjust button table width.
  var buttonTable = document.getElementById('gameButtons');
  buttonTable.style.width = Studio.MAZE_WIDTH + 'px';

  var hintBubble = document.getElementById('bubble');
  hintBubble.style.width = Studio.MAZE_WIDTH + 'px';

  if (skin.background) {
    var tile = document.createElementNS(Blockly.SVG_NS, 'image');
    tile.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                        skin.background);
    tile.setAttribute('id', 'background');
    tile.setAttribute('height', Studio.MAZE_HEIGHT);
    tile.setAttribute('width', Studio.MAZE_WIDTH);
    tile.setAttribute('x', 0);
    tile.setAttribute('y', 0);
    svg.appendChild(tile);
  }

  if (Studio.spriteStart_) {
    for (i = 0; i < Studio.spriteCount; i++) {
      // Sprite clipPath element, whose (x, y) is reset by Studio.displaySprite
      var spriteClip = document.createElementNS(Blockly.SVG_NS, 'clipPath');
      spriteClip.setAttribute('id', 'spriteClipPath' + i);
      var spriteClipRect = document.createElementNS(Blockly.SVG_NS, 'rect');
      spriteClipRect.setAttribute('id', 'spriteClipRect' + i);
      spriteClipRect.setAttribute('width', Studio.SPRITE_WIDTH);
      spriteClipRect.setAttribute('height', Studio.SPRITE_HEIGHT);
      spriteClip.appendChild(spriteClipRect);
      svg.appendChild(spriteClip);

      // Add sprite (not setting href attribute or width until displaySprite).
      var spriteIcon = document.createElementNS(Blockly.SVG_NS, 'image');
      spriteIcon.setAttribute('id', 'sprite' + i);
      spriteIcon.setAttribute('height', Studio.SPRITE_HEIGHT);
      spriteIcon.setAttribute('clip-path', 'url(#spriteClipPath' + i + ')');
      svg.appendChild(spriteIcon);

      dom.addMouseDownTouchEvent(spriteIcon,
                                 delegate(this,
                                          Studio.onSpriteClicked,
                                          i));
    }
    for (i = 0; i < Studio.spriteCount; i++) {
      var spriteSpeechBubble = document.createElementNS(Blockly.SVG_NS, 'g');
      spriteSpeechBubble.setAttribute('id', 'speechBubble' + i);
      spriteSpeechBubble.setAttribute('visibility', 'hidden');

      var speechRect = document.createElementNS(Blockly.SVG_NS, 'path');
      speechRect.setAttribute('id', 'speechBubblePath' + i);
      speechRect.setAttribute('class', 'studio-speech-bubble-path');

      var speechText = document.createElementNS(Blockly.SVG_NS, 'text');
      speechText.setAttribute('id', 'speechBubbleText' + i);
      speechText.setAttribute('class', 'studio-speech-bubble');

      spriteSpeechBubble.appendChild(speechRect);
      spriteSpeechBubble.appendChild(speechText);
      svg.appendChild(spriteSpeechBubble);
    }
  }

  if (Studio.spriteFinish_) {
    for (i = 0; i < Studio.spriteFinishCount; i++) {
      // Add finish markers.
      var spriteFinishMarker = document.createElementNS(
          Blockly.SVG_NS,
          'image');
      spriteFinishMarker.setAttribute('id', 'spriteFinish' + i);
      spriteFinishMarker.setAttributeNS('http://www.w3.org/1999/xlink',
                                        'xlink:href',
                                        skin.goal);
      spriteFinishMarker.setAttribute('height', Studio.MARKER_HEIGHT);
      spriteFinishMarker.setAttribute('width', Studio.MARKER_WIDTH);
      svg.appendChild(spriteFinishMarker);
    }
  }

  var score = document.createElementNS(Blockly.SVG_NS, 'text');
  score.setAttribute('id', 'score');
  score.setAttribute('class', 'studio-score');
  score.setAttribute('x', Studio.MAZE_WIDTH / 2);
  score.setAttribute('y', SCORE_TEXT_Y_POSITION);
  score.appendChild(document.createTextNode(''));
  score.setAttribute('visibility', 'hidden');
  svg.appendChild(score);

  var titleScreenTitle = document.createElementNS(Blockly.SVG_NS, 'text');
  titleScreenTitle.setAttribute('id', 'titleScreenTitle');
  titleScreenTitle.setAttribute('class', 'studio-ts-title');
  titleScreenTitle.setAttribute('x', Studio.MAZE_WIDTH / 2);
  titleScreenTitle.setAttribute('y', TITLE_SCREEN_TITLE_Y_POSITION);
  titleScreenTitle.appendChild(document.createTextNode(''));
  titleScreenTitle.setAttribute('visibility', 'hidden');
  svg.appendChild(titleScreenTitle);

  var titleScreenTextGroup = document.createElementNS(Blockly.SVG_NS, 'g');
  var xPosTextGroup = (Studio.MAZE_WIDTH - TITLE_SCREEN_TEXT_WIDTH) / 2;
  titleScreenTextGroup.setAttribute('id', 'titleScreenTextGroup');
  titleScreenTextGroup.setAttribute('x', xPosTextGroup);
  titleScreenTextGroup.setAttribute('y', TITLE_SCREEN_TEXT_Y_POSITION);
  titleScreenTextGroup.setAttribute(
      'transform',
      'translate(' + xPosTextGroup + ',' + TITLE_SCREEN_TEXT_Y_POSITION + ')');
  titleScreenTextGroup.setAttribute('visibility', 'hidden');

  var titleScreenTextRect = document.createElementNS(Blockly.SVG_NS, 'rect');
  titleScreenTextRect.setAttribute('id', 'titleScreenTextRect');
  titleScreenTextRect.setAttribute('x', 0);
  titleScreenTextRect.setAttribute('y', 0);
  titleScreenTextRect.setAttribute('width', TITLE_SCREEN_TEXT_WIDTH);
  titleScreenTextRect.setAttribute('class', 'studio-ts-text-rect');

  var titleScreenText = document.createElementNS(Blockly.SVG_NS, 'text');
  titleScreenText.setAttribute('id', 'titleScreenText');
  titleScreenText.setAttribute('class', 'studio-ts-text');
  titleScreenText.setAttribute('x', TITLE_SCREEN_TEXT_WIDTH / 2);
  titleScreenText.setAttribute('y', 0);
  titleScreenText.appendChild(document.createTextNode(''));

  titleScreenTextGroup.appendChild(titleScreenTextRect);
  titleScreenTextGroup.appendChild(titleScreenText);
  svg.appendChild(titleScreenTextGroup);
};

var essentiallyEqual = function(float1, float2, opt_variance) {
  var variance = opt_variance || 0.01;
  return (Math.abs(float1 - float2) < variance);
};

/**
 * @param scope Object :  The scope in which to execute the delegated function.
 * @param func Function : The function to execute
 * @param data Object or Array : The data to pass to the function. If the function is also passed arguments, the data is appended to the arguments list. If the data is an Array, each item is appended as a new argument.
 */
var delegate = function(scope, func, data)
{
  return function()
  {
    var args = Array.prototype.slice.apply(arguments).concat(data);
    func.apply(scope, args);
  };
};

var calcMoveDistanceFromQueues = function (index, yAxis, modifyQueues) {
  var totalDistance = 0;

  Studio.eventHandlers.forEach(function (handler) {
    var cmd = handler.cmdQueue ? handler.cmdQueue[0] : null;
    if (cmd && cmd.name === 'moveDistance' && cmd.opts.spriteIndex === index) {
      var scaleFactor;
      var distThisMove = Math.min(cmd.opts.queuedDistance,
                                  Studio.sprite[cmd.opts.spriteIndex].speed);
      switch (cmd.opts.dir) {
        case Direction.NORTH:
          scaleFactor = yAxis ? -1 : 0;
          break;
        case Direction.WEST:
          scaleFactor = yAxis ? 0: -1;
          break;
        case Direction.SOUTH:
          scaleFactor = yAxis ? 1 : 0;
          break;
        case Direction.EAST:
          scaleFactor = yAxis ? 0: 1;
          break;
      }
      if (modifyQueues && (0 !== scaleFactor)) {
        cmd.opts.queuedDistance -= distThisMove;
        if ("0.00" === Math.abs(cmd.opts.queuedDistance).toFixed(2)) {
          cmd.opts.queuedDistance = 0;
        }
      }
      totalDistance += distThisMove * scaleFactor;
    }
  });

  return totalDistance;
};


var cancelQueuedMovements = function (index, yAxis) {
  Studio.eventHandlers.forEach(function (handler) {
    var cmd = handler.cmdQueue ? handler.cmdQueue[0] : null;
    if (cmd && cmd.name === 'moveDistance' && cmd.opts.spriteIndex === index) {
      var dir = cmd.opts.dir;
      if (yAxis && (dir === Direction.NORTH || dir === Direction.SOUTH)) {
        cmd.opts.queuedDistance = 0;
      } else if (!yAxis && (dir === Direction.EAST || dir === Direction.WEST)) {
        cmd.opts.queuedDistance = 0;
      }
    }
  });
};

//
// Return the next position for this sprite on a given coordinate axis
// given the queued moves (yAxis == false means xAxis)
// NOTE: position values returned are not clamped to playspace boundaries
//

var getNextPosition = function (i, yAxis, modifyQueues) {
  var curPos = yAxis ? Studio.sprite[i].y : Studio.sprite[i].x;
  return curPos + calcMoveDistanceFromQueues(i, yAxis, modifyQueues);
};

//
// Perform Queued Moves in the X and Y axes (called from inside onTick)
//
var performQueuedMoves = function (i) {
  // Make queued moves in the X axis (fixed to .01 values):
  var nextX = getNextPosition(i, false, true);
  // Clamp nextX to boundaries as newX:
  var newX = Math.min(Studio.COLS - 2, Math.max(0, nextX));
  if (nextX != newX) {
    cancelQueuedMovements(i, false);
  }
  Studio.sprite[i].x = newX;

  // Make queued moves in the Y axis (fixed to .01 values):
  var nextY = getNextPosition(i, true, true);
  // Clamp nextY to boundaries as newY:
  var newY = Math.min(Studio.ROWS - 2, Math.max(0, nextY));
  if (nextY != newY) {
    cancelQueuedMovements(i, true);
  }
  Studio.sprite[i].y = newY;
};

//
// Set text into SVG text tspan elements (manual word wrapping)
// Thanks http://stackoverflow.com/questions/
//        7046986/svg-using-getcomputedtextlength-to-wrap-text
//
// opts.svgText: existing svg 'text' element
// opts.text: full-length text string
// opts.width: total width
// opts.fullHeight: total height (fits maxLines of text)
// opts.maxLines: max number of text lines
// opts.lineHeight: height per line of text
// opts.topMargin: top margin
// opts.sideMargin: left & right margin (deducted from total width)
//

var setSvgText = function(opts) {
  // Remove any children from the svgText node:
  while (opts.svgText.firstChild) {
    opts.svgText.removeChild(opts.svgText.firstChild);
  }

  var words = opts.text.split(' ');
  // Create first tspan element
  var tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
  tspan.setAttribute("x", opts.width / 2);
  tspan.setAttribute("dy", opts.lineHeight + opts.topMargin);
  // Create text in tspan element
  var text_node = document.createTextNode(words[0]);

  // Add text to tspan element
  tspan.appendChild(text_node);
  // Add tspan element to DOM
  opts.svgText.appendChild(tspan);
  var tSpansAdded = 1;

  for (var i = 1; i < words.length; i++) {
    // Find number of letters in string
    var len = tspan.firstChild.data.length;
    // Add next word
    tspan.firstChild.data += " " + words[i];

    if (tspan.getComputedTextLength() >
        opts.width - 2 * opts.sideMargin) {
      // Remove added word
      tspan.firstChild.data = tspan.firstChild.data.slice(0, len);

      if (opts.maxLines === tSpansAdded) {
        return opts.fullHeight;
      }
      // Create new tspan element
      tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute("x", opts.width / 2);
      tspan.setAttribute("dy", opts.lineHeight);
      text_node = document.createTextNode(words[i]);
      tspan.appendChild(text_node);
      opts.svgText.appendChild(tspan);
      tSpansAdded++;
    }
  }
  var linesLessThanMax = opts.maxLines - Math.max(1, tSpansAdded);
  return opts.fullHeight - linesLessThanMax * opts.lineHeight;
};

//
// Execute the code for all of the event handlers that match an event name
//

var callHandler = function (name) {
  Studio.eventHandlers.forEach(function (handler) {
    // Note: we skip executing the code if we have not completed executing
    // the cmdQueue on this handler (checking for non-zero length)
    if (handler.name === name &&
        (!handler.cmdQueue || 0 === handler.cmdQueue.length)) {
      handler.cmdQueue = [];
      Studio.currentCmdQueue = handler.cmdQueue;
      try { handler.func(BlocklyApps, api, Studio.Globals); } catch (e) { }
      Studio.currentCmdQueue = null;
    }
  });
};

Studio.onTick = function() {
  Studio.tickCount++;

  if (Studio.tickCount === 1) {
    callHandler('whenGameStarts');
  }
  Studio.executeQueue('whenGameStarts');

  callHandler('repeatForever');
  Studio.executeQueue('repeatForever');

  for (var i = 0; i < Studio.spriteCount; i++) {
    Studio.executeQueue('whenSpriteClicked-' + i);
  }

  // Run key event handlers for any keys that are down:
  for (var key in Keycodes) {
    if (Studio.keyState[Keycodes[key]] &&
        Studio.keyState[Keycodes[key]] == "keydown") {
      switch (Keycodes[key]) {
        case Keycodes.LEFT:
          callHandler('whenLeft');
          break;
        case Keycodes.UP:
          callHandler('whenUp');
          break;
        case Keycodes.RIGHT:
          callHandler('whenRight');
          break;
        case Keycodes.DOWN:
          callHandler('whenDown');
          break;
      }
    }
  }

  for (var btn in ArrowIds) {
    if (Studio.btnState[ArrowIds[btn]] &&
        Studio.btnState[ArrowIds[btn]] == ButtonState.DOWN) {
      switch (ArrowIds[btn]) {
        case ArrowIds.LEFT:
          callHandler('whenLeft');
          break;
        case ArrowIds.UP:
          callHandler('whenUp');
          break;
        case ArrowIds.RIGHT:
          callHandler('whenRight');
          break;
        case ArrowIds.DOWN:
          callHandler('whenDown');
          break;
      }
    }
  }

  Studio.executeQueue('whenLeft');
  Studio.executeQueue('whenUp');
  Studio.executeQueue('whenRight');
  Studio.executeQueue('whenDown');

  // Check for collisions (note that we use the positions they are about
  // to attain with queued moves - this allows the moves to be canceled before
  // the actual movements take place):
  for (i = 0; i < Studio.spriteCount; i++) {
    for (var j = 0; j < Studio.spriteCount; j++) {
      if (i == j) {
        continue;
      }
      if (essentiallyEqual(getNextPosition(i, false, false),
                           getNextPosition(j, false, false),
                           tiles.SPRITE_COLLIDE_DISTANCE) &&
          essentiallyEqual(getNextPosition(i, true, false),
                           getNextPosition(j, true, false),
                           tiles.SPRITE_COLLIDE_DISTANCE)) {
        if (0 === (Studio.sprite[i].collisionMask & Math.pow(2, j))) {
          Studio.sprite[i].collisionMask |= Math.pow(2, j);
          callHandler('whenSpriteCollided-' + i + '-' + j);
        }
      } else {
          Studio.sprite[i].collisionMask &= ~(Math.pow(2, j));
      }
      Studio.executeQueue('whenSpriteCollided-' + i + '-' + j);
    }
  }

  for (i = 0; i < Studio.spriteCount; i++) {
    performQueuedMoves(i);

    // Display sprite:
    Studio.displaySprite(i);
  }

  if (checkFinished()) {
    Studio.onPuzzleComplete();
  }
};

Studio.onKey = function(e) {
  // Store the most recent event type per-key
  Studio.keyState[e.keyCode] = e.type;

  // If we are actively running our tick loop, suppress default event handling
  if (Studio.intervalId &&
      e.keyCode >= Keycodes.LEFT && e.keyCode <= Keycodes.DOWN) {
    e.preventDefault();
  }
};

Studio.onArrowButtonDown = function(e, idBtn) {
  // Store the most recent event type per-button
  Studio.btnState[idBtn] = ButtonState.DOWN;
  e.preventDefault();  // Stop normal events so we see mouseup later.
};

Studio.onSpriteClicked = function(e, spriteIndex) {
  // If we are "running", call the event handler if registered.
  if (Studio.intervalId) {
    callHandler('whenSpriteClicked-' + spriteIndex);
  }
  e.preventDefault();  // Stop normal events.
};

Studio.onSvgClicked = function(e) {
  // If we are "running", check the cmdQueues.
  if (Studio.intervalId) {
    // Check the first command in all of the cmdQueues to see if there is a
    // pending "wait for click" command
    Studio.eventHandlers.forEach(function (handler) {
      var cmd = handler.cmdQueue ? handler.cmdQueue[0] : null;

      if (cmd && cmd.opts.waitForClick && !cmd.opts.complete) {
        if (cmd.opts.waitCallback) {
          cmd.opts.waitCallback();
        }
        cmd.opts.complete = true;
      }
    });
  }
  e.preventDefault();  // Stop normal events.
};

Studio.onArrowButtonUp = function(e, idBtn) {
  // Store the most recent event type per-button
  Studio.btnState[idBtn] = ButtonState.UP;
};

Studio.onMouseUp = function(e) {
  // Reset btnState on mouse up
  Studio.btnState = {};
};

/**
 * Initialize Blockly and the Studio app.  Called on page load.
 */
Studio.init = function(config) {
  Studio.clearEventHandlersKillTickLoop();
  skin = config.skin;
  level = config.level;
  onSharePage = config.share;
  loadLevel();

  window.addEventListener("keydown", Studio.onKey, false);
  window.addEventListener("keyup", Studio.onKey, false);

  config.html = page({
    assetUrl: BlocklyApps.assetUrl,
    data: {
      localeDirection: BlocklyApps.localeDirection(),
      visualization: require('./visualization.html')(),
      controls: require('./controls.html')({assetUrl: BlocklyApps.assetUrl}),
      extraControlRows:
          require('./extraControlRows.html')({assetUrl: BlocklyApps.assetUrl}),
      blockUsed: undefined,
      idealBlockNumber: undefined,
      blockCounterClass: 'block-counter-default'
    }
  });

  config.loadAudio = function() {
    Blockly.loadAudio_(skin.winSound, 'win');
    Blockly.loadAudio_(skin.startSound, 'start');
    Blockly.loadAudio_(skin.failureSound, 'failure');
    Blockly.loadAudio_(skin.rubberSound, 'rubber');
    Blockly.loadAudio_(skin.crunchSound, 'crunch');
    Blockly.loadAudio_(skin.flagSound, 'flag');
    Blockly.loadAudio_(skin.winPointSound, 'winpoint');
    Blockly.loadAudio_(skin.winPoint2Sound, 'winpoint2');
    Blockly.loadAudio_(skin.losePointSound, 'losepoint');
    Blockly.loadAudio_(skin.losePoint2Sound, 'losepoint2');
    Blockly.loadAudio_(skin.goal1Sound, 'goal1');
    Blockly.loadAudio_(skin.goal2Sound, 'goal2');
    Blockly.loadAudio_(skin.woodSound, 'wood');
    Blockly.loadAudio_(skin.retroSound, 'retro');
    Blockly.loadAudio_(skin.slapSound, 'slap');
    Blockly.loadAudio_(skin.hitSound, 'hit');
  };

  config.afterInject = function() {
    // Connect up arrow button event handlers
    for (var btn in ArrowIds) {
      dom.addClickTouchEvent(document.getElementById(ArrowIds[btn]),
                             delegate(this,
                                      Studio.onArrowButtonUp,
                                      ArrowIds[btn]));
      dom.addMouseDownTouchEvent(document.getElementById(ArrowIds[btn]),
                                 delegate(this,
                                          Studio.onArrowButtonDown,
                                          ArrowIds[btn]));
    }
    document.addEventListener('mouseup', Studio.onMouseUp, false);

    /**
     * The richness of block colours, regardless of the hue.
     * MOOC blocks should be brighter (target audience is younger).
     * Must be in the range of 0 (inclusive) to 1 (exclusive).
     * Blockly's default is 0.45.
     */
    Blockly.HSV_SATURATION = 0.6;

    Blockly.SNAP_RADIUS *= Studio.scale.snapRadius;

    drawMap();
  };

  config.getDisplayWidth = function() {
    var visualization = document.getElementById('visualization');
    return visualization.getBoundingClientRect().width;
  };

  // TODO: update this for Studio
  // Block placement default (used as fallback in the share levels)
  config.blockArrangement = {
    'studio_whenGameStarts': { x: 20, y: 20},
    'studio_whenLeft': { x: 20, y: 110},
    'studio_whenRight': { x: 180, y: 110},
  };

  config.twitter = twitterOptions;

  // for this app, show make your own button if on share page
  config.makeYourOwn = config.share;

  config.makeString = studioMsg.makeYourOwn();
  config.makeUrl = "http://code.org/studio";
  config.makeImage = BlocklyApps.assetUrl('media/promo.png');

  config.enableShowCode = false;
  config.varsInGlobals = true;
  config.enableShowBlockCount = false;

  config.preventExtraTopLevelBlocks = true;

  Studio.spriteFinishCount = 0;
  Studio.spriteCount = 0;
  Studio.sprite = [];

  // Locate the start and finish squares.
  for (var y = 0; y < Studio.ROWS; y++) {
    for (var x = 0; x < Studio.COLS; x++) {
      if (Studio.map[y][x] & SquareType.SPRITEFINISH) {
        if (0 === Studio.spriteFinishCount) {
          Studio.spriteFinish_ = [];
        }
        Studio.spriteFinish_[Studio.spriteFinishCount] = {x: x, y: y};
        Studio.spriteFinishCount++;
      } else if (Studio.map[y][x] & SquareType.SPRITESTART) {
        if (0 === Studio.spriteCount) {
          Studio.spriteStart_ = [];
        }
        Studio.sprite[Studio.spriteCount] = [];
        Studio.spriteStart_[Studio.spriteCount] = {x: x, y: y};
        Studio.spriteCount++;
      }
    }
  }

  // Update the sprite count in the blocks:
  blocks.setSpriteCount(Blockly, Studio.spriteCount);

  BlocklyApps.init(config);

  if (!onSharePage) {
    var shareButton = document.getElementById('shareButton');
    dom.addClickTouchEvent(shareButton, Studio.onPuzzleComplete);
  }
};

/**
 * Clear the event handlers and stop the onTick timer.
 */
Studio.clearEventHandlersKillTickLoop = function() {
  if (Studio.eventHandlers) {
    // Check the first command in all of the cmdQueues and clear the timeout
    // if there is a pending wait command
    Studio.eventHandlers.forEach(function (handler) {
      var cmd = handler.cmdQueue ? handler.cmdQueue[0] : null;

      if (cmd && cmd.opts.waitTimeout && !cmd.opts.complete) {
        // Note: not calling waitCallback() or setting complete = true
        window.clearTimeout(cmd.opts.waitTimeout);
      }
    });
  }
  Studio.eventHandlers = [];
  if (Studio.intervalId) {
    window.clearInterval(Studio.intervalId);
  }
  Studio.intervalId = 0;
  for (var i = 0; i < Studio.spriteCount; i++) {
    window.clearTimeout(Studio.sprite[i].bubbleTimeout);
  }
};

/**
 * Reset the app to the start position and kill any pending animation tasks.
 * @param {boolean} first True if an opening animation is to be played.
 */
BlocklyApps.reset = function(first) {
  var i;
  Studio.clearEventHandlersKillTickLoop();

  // Soft buttons
  var softButtonCount = 0;
  for (i = 0; i < Studio.softButtons_.length; i++) {
    document.getElementById(Studio.softButtons_[i]).style.display = 'inline';
    softButtonCount++;
  }
  if (softButtonCount) {
    var softButtonsCell = document.getElementById('soft-buttons');
    softButtonsCell.className = 'soft-buttons-' + softButtonCount;
  }

  // Reset the score and title screen.
  Studio.playerScore = 0;
  Studio.opponentScore = 0;
  Studio.scoreText = null;
  document.getElementById('score')
    .setAttribute('visibility', 'hidden');
  document.getElementById('titleScreenTitle')
    .setAttribute('visibility', 'hidden');
  document.getElementById('titleScreenTextGroup')
    .setAttribute('visibility', 'hidden');

  // Reset configurable variables
  Studio.setBackground({'value': 'cave'});

  // Reset currentCmdQueue and various counts:
  Studio.currentCmdQueue = null;
  Studio.sayComplete = 0;
  Studio.playSoundCount = 0;

  // Reset the Globals object used to contain program variables:
  Studio.Globals = [];

  var spriteStartingSkins = [ "dog", "cat", "penguin", "dinosaur", "octopus",
                              "witch" ];
  var numStartingSkins = spriteStartingSkins.length;
  var skinBias = Studio.spriteStartingImage || 0;

  // Move sprites into position.
  for (i = 0; i < Studio.spriteCount; i++) {
    Studio.sprite[i].x = Studio.spriteStart_[i].x;
    Studio.sprite[i].y = Studio.spriteStart_[i].y;
    Studio.sprite[i].speed = tiles.DEFAULT_SPRITE_SPEED;
    Studio.sprite[i].collisionMask = 0;
    Studio.sprite[i].flags = 0;
    Studio.sprite[i].dir = Direction.NONE;
    Studio.sprite[i].displayDir = Direction.SOUTH;
    Studio.sprite[i].emotion = Emotions.NORMAL;

    var opts = {
        'index': i,
        'value': spriteStartingSkins[(i + skinBias) % numStartingSkins]
    };
    if (Studio.spritesHiddenToStart) {
      opts.forceHidden = true;
    }
    Studio.setSprite(opts);
    Studio.displaySprite(i);
    document.getElementById('speechBubble' + i)
      .setAttribute('visibility', 'hidden');
  }

  var svg = document.getElementById('svgStudio');

  if (Studio.spriteFinish_) {
    for (i = 0; i < Studio.spriteFinishCount; i++) {
      // Mark each finish as incomplete.
      Studio.spriteFinish_[i].finished = false;

      // Move the finish icons into position.
      var spriteFinishIcon = document.getElementById('spriteFinish' + i);
      spriteFinishIcon.setAttribute(
          'x',
          Studio.SQUARE_SIZE * Studio.spriteFinish_[i].x);
      spriteFinishIcon.setAttribute(
          'y',
          Studio.SQUARE_SIZE * Studio.spriteFinish_[i].y);
      spriteFinishIcon.setAttributeNS(
          'http://www.w3.org/1999/xlink',
          'xlink:href',
          skin.goal);
    }
  }
};

/**
 * Click the run button.  Start the program.
 */
// XXX This is the only method used by the templates!
BlocklyApps.runButtonClick = function() {
  // Only allow a single top block on some levels.
  if (level.singleTopBlock &&
      Blockly.mainWorkspace.getTopBlocks().length > 1) {
    window.alert(commonMsg.oneTopBlock());
    return;
  }
  var runButton = document.getElementById('runButton');
  var resetButton = document.getElementById('resetButton');
  // Ensure that Reset button is at least as wide as Run button.
  if (!resetButton.style.minWidth) {
    resetButton.style.minWidth = runButton.offsetWidth + 'px';
  }
  runButton.style.display = 'none';
  resetButton.style.display = 'inline';
  Blockly.mainWorkspace.traceOn(true);
  BlocklyApps.reset(false);
  BlocklyApps.attempts++;
  Studio.execute();

  if (level.freePlay && !onSharePage) {
    var shareCell = document.getElementById('share-cell');
    shareCell.className = 'share-cell-enabled';
  }

  if (level.showZeroZeroScore) {
    Studio.displayScore();
  }
};

/**
 * Outcomes of running the user program.
 */
var ResultType = {
  UNSET: 0,
  SUCCESS: 1,
  FAILURE: -1,
  TIMEOUT: 2,
  ERROR: -2
};

/**
 * App specific displayFeedback function that calls into
 * BlocklyApps.displayFeedback when appropriate
 */
var displayFeedback = function() {
  if (!Studio.waitingForReport) {
    BlocklyApps.displayFeedback({
      app: 'studio', //XXX
      skin: skin.id,
      feedbackType: Studio.testResults,
      response: Studio.response,
      level: level,
      showingSharing: level.freePlay,
      twitter: twitterOptions,
      appStrings: {
        reinfFeedbackMsg: studioMsg.reinfFeedbackMsg(),
        sharingText: studioMsg.shareGame()
      }
    });
  }
};

/**
 * Function to be called when the service report call is complete
 * @param {object} JSON response (if available)
 */
Studio.onReportComplete = function(response) {
  Studio.response = response;
  Studio.waitingForReport = false;
  displayFeedback();
};

var registerEventHandler = function (handlers, name, func) {
  handlers.push({'name': name, 'func': func});
};

var registerHandlers =
      function (handlers, blockName, eventNameBase,
                nameParam1, matchParam1Val,
                nameParam2, matchParam2Val) {
  var blocks = Blockly.mainWorkspace.getTopBlocks();
  for (var x = 0; blocks[x]; x++) {
    var block = blocks[x];
    if (block.type === blockName &&
        (!nameParam1 ||
         matchParam1Val === parseInt(block.getTitleValue(nameParam1), 10)) &&
        (!nameParam2 ||
         matchParam2Val === parseInt(block.getTitleValue(nameParam2), 10))) {
      var code = Blockly.Generator.blocksToCode('JavaScript', [ block ]);
      if (code) {
        var func = codegen.functionFromCode(code, {
                                            BlocklyApps: BlocklyApps,
                                            Studio: api,
                                            Globals: Studio.Globals } );
        var eventName = eventNameBase;
        if (nameParam1) {
          eventName += '-' + matchParam1Val;
        }
        if (nameParam2) {
          eventName += '-' + matchParam2Val;
        }
        registerEventHandler(handlers, eventName, func);
      }
    }
  }
};

var registerHandlersWithSpriteParam =
      function (handlers, blockName, eventNameBase, blockParam) {
  for (var i = 0; i < Studio.spriteCount; i++) {
    registerHandlers(handlers, blockName, eventNameBase, blockParam, i);
  }
};

var registerHandlersWithSpriteParams =
      function (handlers, blockName, eventNameBase, blockParam1, blockParam2) {
  for (var i = 0; i < Studio.spriteCount; i++) {
    for (var j = 0; j < Studio.spriteCount; j++) {
      if (i === j) {
        continue;
      }
      registerHandlers(handlers,
                       blockName,
                       eventNameBase,
                       blockParam1,
                       i,
                       blockParam2,
                       j);
    }
  }
};

//
// Generates code with user-generated function definitions and evals that code
// so these can be called from event handlers. This should be called for each
// block type that defines functions.
//

var defineProcedures = function (blockType) {
  var code = Blockly.Generator.workspaceToCode('JavaScript', blockType);
  try { codegen.evalWith(code, {
                         BlocklyApps: BlocklyApps,
                         Studio: api,
                         Globals: Studio.Globals } ); } catch (e) { }
};

/**
 * Execute the story
 */
Studio.execute = function() {
  var code;
  Studio.result = ResultType.UNSET;
  Studio.testResults = BlocklyApps.TestResults.NO_TESTS_RUN;
  Studio.waitingForReport = false;
  Studio.response = null;
  Blockly.Blocks.studio_firstSetSprite = null;
  var i;

  if (level.editCode) {
    var codeTextbox = document.getElementById('codeTextbox');
    code = dom.getText(codeTextbox);
    // Insert aliases from level codeBlocks into code
    if (level.codeFunctions) {
      for (i = 0; i < level.codeFunctions.length; i++) {
        var codeFunction = level.codeFunctions[i];
        if (codeFunction.alias) {
          code = codeFunction.func +
              " = function() { " + codeFunction.alias + " };" + code;
        }
      }
    }
  }

  var handlers = [];
  registerHandlers(handlers, 'studio_whenGameStarts', 'whenGameStarts');
  registerHandlers(handlers, 'studio_whenLeft', 'whenLeft');
  registerHandlers(handlers, 'studio_whenRight', 'whenRight');
  registerHandlers(handlers, 'studio_whenUp', 'whenUp');
  registerHandlers(handlers, 'studio_whenDown', 'whenDown');
  registerHandlers(handlers, 'studio_repeatForever', 'repeatForever');
  registerHandlersWithSpriteParam(handlers,
                                  'studio_whenSpriteClicked',
                                  'whenSpriteClicked',
                                  'SPRITE');
  registerHandlersWithSpriteParams(handlers,
                                   'studio_whenSpriteCollided',
                                   'whenSpriteCollided',
                                   'SPRITE1',
                                   'SPRITE2');

  BlocklyApps.playAudio('start', {volume: 0.5});

  BlocklyApps.reset(false);

  // Define any top-level procedures the user may have created
  // (must be after reset(), which resets the Studio.Globals namespace)
  defineProcedures('procedures_defreturn');
  defineProcedures('procedures_defnoreturn');

  // Set event handlers and start the onTick timer
  Studio.eventHandlers = handlers;
  Studio.tickCount = 0;
  Studio.intervalId = window.setInterval(Studio.onTick, Studio.scale.stepSpeed);
};

Studio.onPuzzleComplete = function() {
  if (level.freePlay) {
    Studio.result = ResultType.SUCCESS;
  }

  // Stop everything on screen
  Studio.clearEventHandlersKillTickLoop();

  // If we know they succeeded, mark levelComplete true
  // Note that we have not yet animated the succesful run
  BlocklyApps.levelComplete = (Studio.result == ResultType.SUCCESS);

  // If the current level is a free play, always return the free play
  // result type
  if (level.freePlay) {
    Studio.testResults = BlocklyApps.TestResults.FREE_PLAY;
  } else {
    Studio.testResults = BlocklyApps.getTestResults();
  }

  if (Studio.testResults >= BlocklyApps.TestResults.FREE_PLAY) {
    BlocklyApps.playAudio('win', {volume : 0.5});
  } else {
    BlocklyApps.playAudio('failure', {volume : 0.5});
  }

  if (level.editCode) {
    Studio.testResults = BlocklyApps.levelComplete ?
      BlocklyApps.TestResults.ALL_PASS :
      BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL;
  }

  if (level.failForOther1Star && !BlocklyApps.levelComplete) {
    Studio.testResults = BlocklyApps.TestResults.OTHER_1_STAR_FAIL;
  }

  var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
  var textBlocks = Blockly.Xml.domToText(xml);

  Studio.waitingForReport = true;

  // Report result to server.
  BlocklyApps.report({
                     app: 'studio',
                     level: level.id,
                     result: Studio.result === ResultType.SUCCESS,
                     testResult: Studio.testResults,
                     program: encodeURIComponent(textBlocks),
                     onComplete: Studio.onReportComplete
                     });
};

var frameDirTable = {};
frameDirTable[Direction.SOUTHEAST]  = 0;
frameDirTable[Direction.EAST]       = 1;
frameDirTable[Direction.NORTHEAST]  = 2;
frameDirTable[Direction.NORTH]      = 3;
frameDirTable[Direction.NORTHWEST]  = 4;
frameDirTable[Direction.WEST]       = 5;
frameDirTable[Direction.SOUTHWEST]  = 6;

var ANIM_RATE = 6;
var ANIM_OFFSET = 7; // Each sprite animates at a slightly different time
var ANIM_AFTER_NUM_NORMAL_FRAMES = 8;

var spriteFrameNumber = function (index) {
  var sprite = Studio.sprite[index];
  var showThisAnimFrame = 0;
  if ((sprite.flags & SpriteFlags.TURNS) &&
      (sprite.displayDir !== Direction.SOUTH)) {
    return sprite.firstTurnFrameNum + frameDirTable[sprite.displayDir];
  }
  if ((sprite.flags & SpriteFlags.ANIMATION) &&
      Studio.tickCount &&
      (1 ===
       Math.round((Studio.tickCount + index * ANIM_OFFSET) / ANIM_RATE) %
                  ANIM_AFTER_NUM_NORMAL_FRAMES)) {
    // we only support two-frame animation for now, the 2nd frame is only up
    // for 1/8th of the time (since it is a blink of the eyes)
    showThisAnimFrame = sprite.firstAnimFrameNum;
  }
  if (sprite.emotion !== Emotions.NORMAL &&
      sprite.flags & SpriteFlags.EMOTIONS) {
    return showThisAnimFrame ?
            showThisAnimFrame :
            sprite.firstEmotionFrameNum + (sprite.emotion - 1);
  }
  return showThisAnimFrame;
};

var spriteTotalFrames = function (index) {
  var frames = SpriteCounts.NORMAL;
  if (Studio.sprite[index].flags & SpriteFlags.ANIMATION) {
    frames += SpriteCounts.ANIMATION;
  }
  if (Studio.sprite[index].flags & SpriteFlags.TURNS) {
    frames += SpriteCounts.TURNS;
  }
  if (Studio.sprite[index].flags & SpriteFlags.EMOTIONS) {
    frames += SpriteCounts.EMOTIONS;
  }
  return frames;
};

var updateSpeechBubblePath = function (element) {
  var height = +element.getAttribute('height');
  var onTop = 'true' === element.getAttribute('onTop');
  var onRight = 'true' === element.getAttribute('onRight');
  element.setAttribute('d',
                       createSpeechBubblePath(0,
                                              0,
                                              SPEECH_BUBBLE_WIDTH,
                                              height,
                                              SPEECH_BUBBLE_RADIUS,
                                              onTop,
                                              onRight));
};

Studio.displaySprite = function(i) {
  var xCoord = Studio.sprite[i].x * Studio.SQUARE_SIZE;
  var yCoord = Studio.sprite[i].y * Studio.SQUARE_SIZE + Studio.SPRITE_Y_OFFSET;

  var xOffset = Studio.SPRITE_WIDTH * spriteFrameNumber(i);

  var spriteIcon = document.getElementById('sprite' + i);
  var spriteClipRect = document.getElementById('spriteClipRect' + i);

  var xCoordPrev = spriteClipRect.getAttribute('x');
  var yCoordPrev = spriteClipRect.getAttribute('y');

  var dirPrev = Studio.sprite[i].dir;
  if (dirPrev === Direction.NONE) {
    // direction not yet set, start at SOUTH (forward facing)
    Studio.sprite[i].dir = Direction.SOUTH;
  }
  else if ((xCoord != xCoordPrev) || (yCoord != yCoordPrev)) {
    Studio.sprite[i].dir = Direction.NONE;
    if (xCoord < xCoordPrev) {
      Studio.sprite[i].dir |= Direction.WEST;
    } else if (xCoord > xCoordPrev) {
      Studio.sprite[i].dir |= Direction.EAST;
    }
    if (yCoord < yCoordPrev) {
      Studio.sprite[i].dir |= Direction.NORTH;
    } else if (yCoord > yCoordPrev) {
      Studio.sprite[i].dir |= Direction.SOUTH;
    }
  }

  if (Studio.sprite[i].dir !== Studio.sprite[i].displayDir) {
    // Every other frame, assign a new displayDir from state table
    // (only one turn at a time):
    if (Studio.tickCount && (0 === Studio.tickCount % 2)) {
      Studio.sprite[i].displayDir =
          NextTurn[Studio.sprite[i].displayDir][Studio.sprite[i].dir];
    }
  }

  spriteIcon.setAttribute('x', xCoord - xOffset);
  spriteIcon.setAttribute('y', yCoord);

  spriteClipRect.setAttribute('x', xCoord);
  spriteClipRect.setAttribute('y', yCoord);

  var speechBubble = document.getElementById('speechBubble' + i);
  var speechBubblePath = document.getElementById('speechBubblePath' + i);
  var bblHeight = +speechBubblePath.getAttribute('height');
  var wasOnTop = 'true' === speechBubblePath.getAttribute('onTop');
  var wasOnRight = 'true' === speechBubblePath.getAttribute('onRight');
  var nowOnTop = true;
  var nowOnRight = true;
  var ySpeech = yCoord - (bblHeight + SPEECH_BUBBLE_PADDING);
  if (ySpeech < 0) {
    ySpeech = yCoord + Studio.SPRITE_HEIGHT + SPEECH_BUBBLE_PADDING;
    nowOnTop = false;
  }
  var xSpeech = xCoord + SPEECH_BUBBLE_H_OFFSET;
  if (xSpeech > Studio.MAZE_WIDTH - SPEECH_BUBBLE_WIDTH) {
    xSpeech = xCoord + Studio.SPRITE_WIDTH -
                (SPEECH_BUBBLE_WIDTH + SPEECH_BUBBLE_H_OFFSET);
    nowOnRight = false;
  }
  speechBubblePath.setAttribute('onTop', nowOnTop);
  speechBubblePath.setAttribute('onRight', nowOnRight);

  if (wasOnTop !== nowOnTop || wasOnRight !== nowOnRight) {
    updateSpeechBubblePath(speechBubblePath);
  }

  speechBubble.setAttribute('transform',
                            'translate(' + xSpeech + ',' + ySpeech + ')');
};

Studio.displayScore = function() {
  var score = document.getElementById('score');
  if (Studio.scoreText) {
    score.textContent = Studio.scoreText;
  } else {
    score.textContent = studioMsg.scoreText({
      playerScore: Studio.playerScore,
      opponentScore: Studio.opponentScore
    });
  }
  score.setAttribute('visibility', 'visible');
};

var skinTheme = function (value) {
  if (value === 'witch') {
    return skin;
  }
  return skin[value];
};

Studio.queueCmd = function (id, name, opts) {
  var cmd = {
      'id': id,
      'name': name,
      'opts': opts,
  };
  Studio.currentCmdQueue.push(cmd);
};

Studio.executeQueue = function (name) {
  Studio.eventHandlers.forEach(function (handler) {
    if (handler.name === name && handler.cmdQueue) {
      for (var cmd = handler.cmdQueue[0]; cmd; cmd = handler.cmdQueue[0]) {
        if (Studio.callCmd(cmd)) {
          // Command executed immediately, remove from queue and continue
          handler.cmdQueue.shift();
        } else {
          break;
        }
      }
    }
  });
};

//
// Execute a command from a command queue
//
// Return false if the command is not complete (it will remain in the queue)
// and this function will be called again with the same command later
//
// Return true if the command is complete
//

Studio.callCmd = function (cmd) {
  switch (cmd.name) {
    case 'setBackground':
      BlocklyApps.highlight(cmd.id);
      Studio.setBackground(cmd.opts);
      break;
    case 'setSprite':
      BlocklyApps.highlight(cmd.id);
      Studio.setSprite(cmd.opts);
      break;
    case 'saySprite':
      if (!cmd.opts.started) {
        BlocklyApps.highlight(cmd.id);
      }
      return Studio.saySprite(cmd.opts);
    case 'setSpriteEmotion':
      BlocklyApps.highlight(cmd.id);
      Studio.setSpriteEmotion(cmd.opts);
      break;
    case 'setSpriteSpeed':
      BlocklyApps.highlight(cmd.id);
      Studio.setSpriteSpeed(cmd.opts);
      break;
    case 'setSpritePosition':
      BlocklyApps.highlight(cmd.id);
      Studio.setSpritePosition(cmd.opts);
      break;
    case 'playSound':
      BlocklyApps.highlight(cmd.id);
      BlocklyApps.playAudio(cmd.opts.soundName, {volume: 0.5});
      Studio.playSoundCount++;
      break;
    case 'showTitleScreen':
      if (!cmd.opts.started) {
        BlocklyApps.highlight(cmd.id);
      }
      return Studio.showTitleScreen(cmd.opts);
    case 'move':
      BlocklyApps.highlight(cmd.id);
      Studio.moveSingle(cmd.opts);
      break;
    case 'moveDistance':
      if (!cmd.opts.started) {
        BlocklyApps.highlight(cmd.id);
      }
      return Studio.moveDistance(cmd.opts);
    case 'stop':
      BlocklyApps.highlight(cmd.id);
      Studio.stop(cmd.opts);
      break;
    case 'incrementScore':
      BlocklyApps.highlight(cmd.id);
      Studio.incrementScore(cmd.opts);
      break;
    case 'setScoreText':
      BlocklyApps.highlight(cmd.id);
      Studio.setScoreText(cmd.opts);
      break;
    case 'wait':
      if (!cmd.opts.started) {
        BlocklyApps.highlight(cmd.id);
      }
      return Studio.wait(cmd.opts);
  }
  return true;
};

Studio.setSpriteEmotion = function (opts) {
  Studio.sprite[opts.spriteIndex].emotion = opts.value;
};

Studio.setSpriteSpeed = function (opts) {
  Studio.sprite[opts.spriteIndex].speed = opts.value;
};

Studio.incrementScore = function (opts) {
  if (opts.player == "opponent") {
    Studio.opponentScore++;
  } else {
    Studio.playerScore++;
  }
  Studio.displayScore();
};

Studio.setScoreText = function (opts) {
  Studio.scoreText = opts.text;
  Studio.displayScore();
};

Studio.setBackground = function (opts) {
  var element = document.getElementById('background');
  element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
    skinTheme(opts.value).background);
};

var computeSpriteFrameNums = function (index) {
  var flags = Studio.sprite[index].flags;
  Studio.sprite[index].firstAnimFrameNum = SpriteCounts.NORMAL;
  Studio.sprite[index].firstTurnFrameNum = SpriteCounts.NORMAL +
      ((flags & SpriteFlags.ANIMATION) ? SpriteCounts.ANIMATION : 0);
  Studio.sprite[index].firstEmotionFrameNum =
      Studio.sprite[index].firstTurnFrameNum +
      ((flags & SpriteFlags.TURNS) ? SpriteCounts.TURNS : 0);
};

Studio.setSprite = function (opts) {
  // Inherit some flags from the skin:
  if (opts.value !== 'hidden' && opts.value !== 'visible') {
    Studio.sprite[opts.index].flags &= ~SF_SKINS_MASK;
    Studio.sprite[opts.index].flags |= skinTheme(opts.value).spriteFlags;
  }
  Studio.sprite[opts.index].value = opts.forceHidden ? 'hidden' : opts.value;

  var element = document.getElementById('sprite' + opts.index);
  element.setAttribute(
      'visibility',
      (opts.value === 'hidden' || opts.forceHidden) ? 'hidden' : 'visible');
  if ((opts.value !== 'hidden') && (opts.value !== 'visible')) {
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                           skinTheme(opts.value).sprite);
    element.setAttribute('width',
                         Studio.SPRITE_WIDTH * spriteTotalFrames(opts.index));
    computeSpriteFrameNums(opts.index);
    // call display right away since the frame number may have changed:
    Studio.displaySprite(opts.index);
  }
};

var p = function (x,y) {
  return x + " " + y + " ";
};

var TIP_HEIGHT = 15;
var TIP_WIDTH = 25;
var TIP_X_SHIFT = 10;

//
// createSpeechBubblePath creates a SVG path that looks like a rounded rect
// plus a 'tip' that points back to the sprite.
//
// x, y is the top left position. w, h, r are width/height/radius (for corners)
// onTop, onRight are booleans that are used to tell this function if the
//     bubble is appearing on top and on the right of the sprite.
//
// Thanks to Remy for the original rounded rect path function
/*
http://www.remy-mellet.com/blog/179-draw-rectangle-with-123-or-4-rounded-corner/
*/

var createSpeechBubblePath = function (x, y, w, h, r, onTop, onRight) {
  var strPath = "M"+p(x+r,y); //A
  if (!onTop) {
    if (onRight) {
      strPath+="L"+p(x+r-TIP_X_SHIFT,y-TIP_HEIGHT)+"L"+p(x+r+TIP_WIDTH,y);
    } else {
      strPath+="L"+p(x+w-r-TIP_WIDTH,y)+"L"+p(x+w-TIP_X_SHIFT,y-TIP_HEIGHT);
    }
  }
  strPath+="L"+p(x+w-r,y);
  strPath+="Q"+p(x+w,y)+p(x+w,y+r); //B
  strPath+="L"+p(x+w,y+h-r)+"Q"+p(x+w,y+h)+p(x+w-r,y+h); //C
  if (onTop) {
    if (onRight) {
      strPath+="L"+p(x+r+TIP_WIDTH,y+h)+"L"+p(x+r-TIP_X_SHIFT,y+h+TIP_HEIGHT);
    } else {
      strPath+="L"+p(x+w-TIP_X_SHIFT,y+h+TIP_HEIGHT)+"L"+p(x+w-r-TIP_WIDTH,y+h);
    }
  }
  strPath+="L"+p(x+r,y+h);
  strPath+="Q"+p(x,y+h)+p(x,y+h-r); //D
  strPath+="L"+p(x,y+r)+"Q"+p(x,y)+p(x+r,y); //A
  strPath+="Z";
  return strPath;
};

var onWaitComplete = function (opts) {
  if (!opts.complete) {
    if (opts.waitCallback) {
      opts.waitCallback();
    }
    opts.complete = true;
  }
};

Studio.wait = function (opts) {
  if (!opts.started) {
    opts.started = true;

    // opts.value is the number of milliseconds to wait - or zero which means
    // "wait for click"
    if (0 === opts.value) {
      opts.waitForClick = true;
    } else {
      opts.waitTimeout = window.setTimeout(
        delegate(this, onWaitComplete, opts),
        opts.value);
    }
  }

  return opts.complete;
};

//
// setSpritePositionInstant is used internally so a sprite can be moved
// instantly, without waiting for the next onTick - and optionally overriding
// the displayDir after movement (otherwise it will revert to SOUTH)
//

var setSpritePositionInstant = function (i, x, y, displayDir) {
  var sprite = Studio.sprite[i];
  Studio.setSpritePosition({'spriteIndex': i, 'x': x, 'y': y});
  if (displayDir) {
      sprite.dir = displayDir;
      sprite.displayDir = displayDir;
  }

  // Move the spriteClipRect manually so that the next ontick() doesn't
  // interpret this change in position as one that requires rotating
  // the sprite through various directions
  var spriteClipRect = document.getElementById('spriteClipRect' + i);
  var xCoord = sprite.x * Studio.SQUARE_SIZE;
  var yCoord = sprite.y * Studio.SQUARE_SIZE + Studio.SPRITE_Y_OFFSET;
  spriteClipRect.setAttribute('x', xCoord);
  spriteClipRect.setAttribute('y', yCoord);
};

Studio.hideTitleScreen = function (opts) {
  if (opts.titleSprite) {
    // If we have displayed a title sprite and nobody has moved or changed
    // it while the title screen was displayed, then restore it now:
    var sprite = Studio.sprite[opts.titleSprite.index];
    if (sprite.x === TITLE_SPRITE_X_POS &&
        sprite.y === TITLE_SPRITE_Y_POS &&
        (sprite.value === opts.titleSprite.value) ||
         ((sprite.value !== 'hidden') &&
           (opts.titleSprite.value === 'visible'))) {
      Studio.setSprite({'index': opts.titleSprite.index,
                        'value': opts.titleSprite.prevValue});
      setSpritePositionInstant(opts.titleSprite.index,
                               opts.titleSprite.prevX,
                               opts.titleSprite.prevY,
                               opts.titleSprite.prevDisplayDir);

    }
  }

  var tsTitle = document.getElementById('titleScreenTitle');
  var tsTextGroup = document.getElementById('titleScreenTextGroup');
  tsTitle.setAttribute('visibility', 'hidden');
  tsTextGroup.setAttribute('visibility', 'hidden');

  opts.complete = true;
};

Studio.showTitleScreen = function (opts) {
  if (!opts.started) {
    opts.started = true;
    var tsTitle = document.getElementById('titleScreenTitle');
    var tsTextGroup = document.getElementById('titleScreenTextGroup');
    var tsText = document.getElementById('titleScreenText');
    var tsTextRect = document.getElementById('titleScreenTextRect');
    tsTitle.textContent = opts.title;
    var svgTextOpts = {
      'svgText': tsText,
      'text': opts.text,
      'width': TITLE_SCREEN_TEXT_WIDTH,
      'lineHeight': TITLE_SCREEN_TEXT_LINE_HEIGHT,
      'topMargin': TITLE_SCREEN_TEXT_TOP_MARGIN,
      'sideMargin': TITLE_SCREEN_TEXT_SIDE_MARGIN,
      'maxLines': TITLE_SCREEN_TEXT_MAX_LINES,
      'fullHeight': TITLE_SCREEN_TEXT_HEIGHT,
    };
    var tsTextHeight = setSvgText(svgTextOpts);
    tsTextRect.setAttribute('height', tsTextHeight);

    tsTitle.setAttribute('visibility', 'visible');
    tsTextGroup.setAttribute('visibility', 'visible');

    if (Blockly.Blocks.studio_firstSetSprite) {
      // If we sniffed out some knowledge around the first setSprite call,
      // then we will borrow that sprite and show it temporarily at the bottom
      // of the title screen (storing its previous state for later recovery):
      var fSS = Blockly.Blocks.studio_firstSetSprite;
      var sprite = Studio.sprite[fSS.index];
      opts.titleSprite = {
        'index': fSS.index,
        'value': fSS.value,
        'prevX': sprite.x,
        'prevY': sprite.y,
        'prevDisplayDir': sprite.displayDir,
        'prevValue': sprite.value,
      };
      Studio.setSprite({'index': fSS.index, 'value': fSS.value});
      setSpritePositionInstant(fSS.index,
                               TITLE_SPRITE_X_POS,
                               TITLE_SPRITE_Y_POS,
                               Direction.SOUTH);
    }

    // Wait for a click or a timeout
    opts.waitForClick = true;
    opts.waitCallback = delegate(this, Studio.hideTitleScreen, opts);
    opts.waitTimeout = window.setTimeout(
        delegate(this, onWaitComplete, opts),
        Studio.TITLE_SCREEN_TIMEOUT);
  }

  return opts.complete;
};

Studio.hideSpeechBubble = function (opts) {
  var speechBubble = document.getElementById('speechBubble' + opts.spriteIndex);
  speechBubble.setAttribute('visibility', 'hidden');
  speechBubble.removeAttribute('onTop');
  speechBubble.removeAttribute('onRight');
  speechBubble.removeAttribute('height');
  opts.complete = true;
  Studio.sayComplete++;
};

Studio.saySprite = function (opts) {
  if (!opts.started) {
    opts.started = true;
    var bblText =
        document.getElementById('speechBubbleText' + opts.spriteIndex);

    var svgTextOpts = {
      'svgText': bblText,
      'text': opts.text,
      'width': SPEECH_BUBBLE_WIDTH,
      'lineHeight': SPEECH_BUBBLE_LINE_HEIGHT,
      'topMargin': SPEECH_BUBBLE_TOP_MARGIN,
      'sideMargin': SPEECH_BUBBLE_SIDE_MARGIN,
      'maxLines': SPEECH_BUBBLE_MAX_LINES,
      'fullHeight': SPEECH_BUBBLE_HEIGHT,
    };
    var bblHeight = setSvgText(svgTextOpts);
    var speechBubblePath =
        document.getElementById('speechBubblePath' + opts.spriteIndex);
    var speechBubble =
        document.getElementById('speechBubble' + opts.spriteIndex);

    speechBubblePath.setAttribute('height', bblHeight);
    updateSpeechBubblePath(speechBubblePath);

    // displaySprite will reposition the bubble
    Studio.displaySprite(opts.spriteIndex);
    speechBubble.setAttribute('visibility', 'visible');

    window.clearTimeout(Studio.sprite[opts.spriteIndex].bubbleTimeout);
    Studio.sprite[opts.spriteIndex].bubbleTimeout = window.setTimeout(
        delegate(this, Studio.hideSpeechBubble, opts),
        Studio.SPEECH_BUBBLE_TIMEOUT);
  }

  return opts.complete;
};

Studio.stop = function (opts) {
  cancelQueuedMovements(opts.spriteIndex, true);
  cancelQueuedMovements(opts.spriteIndex, false);

  if (!opts.dontResetCollisions) {
    // Reset collisionMasks so the next movement will fire another collision
    // event against the same sprite if needed. This makes it easier to write code
    // that says "when sprite X touches Y" => "stop sprite X", and have it do what
    // you expect it to do...
    Studio.sprite[opts.spriteIndex].collisionMask = 0;
    for (var i = 0; i < Studio.spriteCount; i++) {
      if (i === opts.spriteIndex) {
        continue;
      }
      Studio.sprite[i].collisionMask &= ~(Math.pow(2, opts.spriteIndex));
    }
  }
};

Studio.setSpritePosition = function (opts) {
  var sprite = Studio.sprite[opts.spriteIndex];
  var samePosition = (sprite.x === opts.x && sprite.y === opts.y);

  // Don't reset collisions inside stop() if we're in the same position
  Studio.stop({'spriteIndex': opts.spriteIndex,
               'dontResetCollisions': samePosition});
  sprite.x = opts.x;
  sprite.y = opts.y;
  // Reset to "no direction" so no turn animation will take place
  sprite.dir = Direction.NONE;
};

Studio.moveSingle = function (opts) {
  var sprite = Studio.sprite[opts.spriteIndex];
  switch (opts.dir) {
    case Direction.NORTH:
      sprite.y -= sprite.speed;
      if (sprite.y < 0) {
        sprite.y = 0;
      }
      break;
    case Direction.EAST:
      sprite.x += sprite.speed;
      if (sprite.x > (Studio.COLS - 2)) {
        sprite.x = Studio.COLS - 2;
      }
      break;
    case Direction.SOUTH:
      sprite.y += sprite.speed;
      if (sprite.y > (Studio.ROWS - 2)) {
        sprite.y = Studio.ROWS - 2;
      }
      break;
    case Direction.WEST:
      sprite.x -= sprite.speed;
      if (sprite.x < 0) {
        sprite.x = 0;
      }
      break;
  }
};

Studio.moveDistance = function (opts) {
  if (!opts.started) {
    opts.started = true;
    opts.queuedDistance = opts.distance / Studio.SQUARE_SIZE;
  }

  return (0 === opts.queuedDistance);
};

Studio.timedOut = function() {
  return Studio.tickCount > Studio.timeoutFailureTick;
};

Studio.allFinishesComplete = function() {
  var i;
  if (Studio.spriteFinish_) {
    var finished, playSound;
    for (i = 0, finished = 0; i < Studio.spriteFinishCount; i++) {
      if (!Studio.spriteFinish_[i].finished) {
        if (essentiallyEqual(Studio.sprite[Studio.spriteFinishIndex].x,
                             Studio.spriteFinish_[i].x,
                             tiles.FINISH_COLLIDE_DISTANCE) &&
            essentiallyEqual(Studio.sprite[Studio.spriteFinishIndex].y,
                             Studio.spriteFinish_[i].y,
                             tiles.FINISH_COLLIDE_DISTANCE)) {
          Studio.spriteFinish_[i].finished = true;
          finished++;
          playSound = true;

          // Change the finish icon to goalSuccess.
          var spriteFinishIcon = document.getElementById('spriteFinish' + i);
          spriteFinishIcon.setAttributeNS(
              'http://www.w3.org/1999/xlink',
              'xlink:href',
              skin.goalSuccess);
        }
      } else {
        finished++;
      }
    }
    if (playSound && finished != Studio.spriteFinishCount) {
      // Play a sound unless we've hit the last flag
      BlocklyApps.playAudio('flag', {volume: 0.5});
    }
    return (finished == Studio.spriteFinishCount);
  }
  return false;
};

var checkFinished = function () {
  // if we have a succcess condition and have accomplished it, we're done and successful
  if (level.goal && level.goal.successCondition && level.goal.successCondition()) {
    Studio.result = ResultType.SUCCESS;
    return true;
  }

  // if we have a failure condition, and it's been reached, we're done and failed
  if (level.goal && level.goal.failureCondition && level.goal.failureCondition()) {
    Studio.result = ResultType.FAILURE;
    return true;
  }

  if (Studio.allFinishesComplete()) {
    Studio.result = ResultType.SUCCESS;
    return true;
  }

  if (Studio.timedOut()) {
    Studio.result = ResultType.FAILURE;
    return true;
  }

  return false;
};

},{"../../locale/pt_pt/common":36,"../../locale/pt_pt/studio":37,"../base":2,"../codegen":6,"../dom":7,"../feedback.js":8,"../skins":11,"../templates/page.html":29,"./api":13,"./blocks":14,"./controls.html":15,"./extraControlRows.html":16,"./tiles":21,"./visualization.html":22}],21:[function(require,module,exports){
'use strict';

exports.Direction = {
  NONE: 0,
  NORTH: 1,
  EAST: 2,
  SOUTH: 4,
  WEST: 8,
  NORTHEAST: 3,
  SOUTHEAST: 6,
  SOUTHWEST: 12,
  NORTHWEST: 9,
};

exports.Position = {
  TOPLEFT: 1,
  TOPCENTER: 2,
  TOPRIGHT: 3,
  MIDDLELEFT: 4,
  MIDDLECENTER: 5,
  MIDDLERIGHT: 6,
  BOTTOMLEFT: 7,
  BOTTOMCENTER: 8,
  BOTTOMRIGHT: 9,
};

//
// Coordinates for each Position (revisit when Sprite size is variable)
//

var Pos = exports.Position;

exports.xFromPosition = {};
exports.xFromPosition[Pos.TOPLEFT] = 0;
exports.xFromPosition[Pos.TOPCENTER] = 3;
exports.xFromPosition[Pos.TOPRIGHT] = 6;
exports.xFromPosition[Pos.MIDDLELEFT] = 0;
exports.xFromPosition[Pos.MIDDLECENTER] = 3;
exports.xFromPosition[Pos.MIDDLERIGHT] = 6;
exports.xFromPosition[Pos.BOTTOMLEFT] = 0;
exports.xFromPosition[Pos.BOTTOMCENTER] = 3;
exports.xFromPosition[Pos.BOTTOMRIGHT] = 6;

exports.yFromPosition = {};
exports.yFromPosition[Pos.TOPLEFT] = 0;
exports.yFromPosition[Pos.TOPCENTER] = 0;
exports.yFromPosition[Pos.TOPRIGHT] = 0;
exports.yFromPosition[Pos.MIDDLELEFT] = 3;
exports.yFromPosition[Pos.MIDDLECENTER] = 3;
exports.yFromPosition[Pos.MIDDLERIGHT] = 3;
exports.yFromPosition[Pos.BOTTOMLEFT] = 6;
exports.yFromPosition[Pos.BOTTOMCENTER] = 6;
exports.yFromPosition[Pos.BOTTOMRIGHT] = 6;

//
// Turn state machine, use as NextTurn[fromDir][toDir]
//

var Dir = exports.Direction;

exports.NextTurn = {};

exports.NextTurn[Dir.NORTH] = {};
exports.NextTurn[Dir.NORTH][Dir.NORTH] = Dir.NORTH;
exports.NextTurn[Dir.NORTH][Dir.EAST] = Dir.NORTHEAST;
exports.NextTurn[Dir.NORTH][Dir.SOUTH] = Dir.NORTHEAST;
exports.NextTurn[Dir.NORTH][Dir.WEST] = Dir.NORTHWEST;
exports.NextTurn[Dir.NORTH][Dir.NORTHEAST] = Dir.NORTHEAST;
exports.NextTurn[Dir.NORTH][Dir.SOUTHEAST] = Dir.NORTHEAST;
exports.NextTurn[Dir.NORTH][Dir.SOUTHWEST] = Dir.NORTHWEST;
exports.NextTurn[Dir.NORTH][Dir.NORTHWEST] = Dir.NORTHWEST;

exports.NextTurn[Dir.EAST] = {};
exports.NextTurn[Dir.EAST][Dir.NORTH] = Dir.NORTHEAST;
exports.NextTurn[Dir.EAST][Dir.EAST] = Dir.EAST;
exports.NextTurn[Dir.EAST][Dir.SOUTH] = Dir.SOUTHEAST;
exports.NextTurn[Dir.EAST][Dir.WEST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.EAST][Dir.NORTHEAST] = Dir.NORTHEAST;
exports.NextTurn[Dir.EAST][Dir.SOUTHEAST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.EAST][Dir.SOUTHWEST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.EAST][Dir.NORTHWEST] = Dir.NORTHEAST;

exports.NextTurn[Dir.SOUTH] = {};
exports.NextTurn[Dir.SOUTH][Dir.NORTH] = Dir.SOUTHEAST;
exports.NextTurn[Dir.SOUTH][Dir.EAST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.SOUTH][Dir.SOUTH] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTH][Dir.WEST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.SOUTH][Dir.NORTHEAST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.SOUTH][Dir.SOUTHEAST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.SOUTH][Dir.SOUTHWEST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.SOUTH][Dir.NORTHWEST] = Dir.SOUTHWEST;

exports.NextTurn[Dir.WEST] = {};
exports.NextTurn[Dir.WEST][Dir.NORTH] = Dir.NORTHWEST;
exports.NextTurn[Dir.WEST][Dir.EAST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.WEST][Dir.SOUTH] = Dir.SOUTHWEST;
exports.NextTurn[Dir.WEST][Dir.WEST] = Dir.WEST;
exports.NextTurn[Dir.WEST][Dir.NORTHEAST] = Dir.NORTHWEST;
exports.NextTurn[Dir.WEST][Dir.SOUTHEAST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.WEST][Dir.SOUTHWEST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.WEST][Dir.NORTHWEST] = Dir.NORTHWEST;

exports.NextTurn[Dir.NORTHEAST] = {};
exports.NextTurn[Dir.NORTHEAST][Dir.NORTH] = Dir.NORTH;
exports.NextTurn[Dir.NORTHEAST][Dir.EAST] = Dir.EAST;
exports.NextTurn[Dir.NORTHEAST][Dir.SOUTH] = Dir.EAST;
exports.NextTurn[Dir.NORTHEAST][Dir.WEST] = Dir.NORTH;
exports.NextTurn[Dir.NORTHEAST][Dir.NORTHEAST] = Dir.NORTHEAST;
exports.NextTurn[Dir.NORTHEAST][Dir.SOUTHEAST] = Dir.EAST;
exports.NextTurn[Dir.NORTHEAST][Dir.SOUTHWEST] = Dir.EAST;
exports.NextTurn[Dir.NORTHEAST][Dir.NORTHWEST] = Dir.NORTH;

exports.NextTurn[Dir.SOUTHEAST] = {};
exports.NextTurn[Dir.SOUTHEAST][Dir.NORTH] = Dir.EAST;
exports.NextTurn[Dir.SOUTHEAST][Dir.EAST] = Dir.EAST;
exports.NextTurn[Dir.SOUTHEAST][Dir.SOUTH] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHEAST][Dir.WEST] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHEAST][Dir.NORTHEAST] = Dir.EAST;
exports.NextTurn[Dir.SOUTHEAST][Dir.SOUTHEAST] = Dir.SOUTHEAST;
exports.NextTurn[Dir.SOUTHEAST][Dir.SOUTHWEST] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHEAST][Dir.NORTHWEST] = Dir.SOUTH;

exports.NextTurn[Dir.SOUTHWEST] = {};
exports.NextTurn[Dir.SOUTHWEST][Dir.NORTH] = Dir.WEST;
exports.NextTurn[Dir.SOUTHWEST][Dir.EAST] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHWEST][Dir.SOUTH] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHWEST][Dir.WEST] = Dir.WEST;
exports.NextTurn[Dir.SOUTHWEST][Dir.NORTHEAST] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHWEST][Dir.SOUTHEAST] = Dir.SOUTH;
exports.NextTurn[Dir.SOUTHWEST][Dir.SOUTHWEST] = Dir.SOUTHWEST;
exports.NextTurn[Dir.SOUTHWEST][Dir.NORTHWEST] = Dir.WEST;

exports.NextTurn[Dir.NORTHWEST] = {};
exports.NextTurn[Dir.NORTHWEST][Dir.NORTH] = Dir.NORTH;
exports.NextTurn[Dir.NORTHWEST][Dir.EAST] = Dir.NORTH;
exports.NextTurn[Dir.NORTHWEST][Dir.SOUTH] = Dir.WEST;
exports.NextTurn[Dir.NORTHWEST][Dir.WEST] = Dir.WEST;
exports.NextTurn[Dir.NORTHWEST][Dir.NORTHEAST] = Dir.NORTH;
exports.NextTurn[Dir.NORTHWEST][Dir.SOUTHEAST] = Dir.WEST;
exports.NextTurn[Dir.NORTHWEST][Dir.SOUTHWEST] = Dir.WEST;
exports.NextTurn[Dir.NORTHWEST][Dir.NORTHWEST] = Dir.NORTHWEST;


exports.Emotions = {
  NORMAL: 0,
  HAPPY: 1,
  ANGRY: 2,
  SAD: 3,
};

exports.FINISH_COLLIDE_DISTANCE = 1.5;
exports.SPRITE_COLLIDE_DISTANCE = 1.8;
exports.DEFAULT_SPRITE_SPEED = 0.1;

/**
 * The types of squares in the maze, which is represented
 * as a 2D array of SquareType values.
 * @enum {number}
 */
exports.SquareType = {
  OPEN: 0,
  SPRITEFINISH: 1,
  SPRITESTART: 16,
};

},{}],22:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="svgStudio">\n</svg>\n<div id="capacityBubble">\n  <div id="capacity"></div>\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],23:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<div><span>Instructions: </span><textarea type="text" name="instructions"></textarea></div>\n<div><span>Level Name: </span><textarea type="text" name="level_name"></textarea></div>\n<button id="create-level-button" class="launch">\n  Create Level\n</button>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],24:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common'); ; buf.push('\n\n');3; if (data.ok) {; buf.push('  <div class="farSide" style="padding: 1ex 3ex 0">\n    <button id="ok-button" class="secondary">\n      ', escape((5,  msg.dialogOK() )), '\n    </button>\n  </div>\n');8; }; buf.push('\n');9; if (data.previousLevel) {; buf.push('  <button id="back-button" class="launch">\n    ', escape((10,  msg.backToPreviousLevel() )), '\n  </button>\n');12; }; buf.push('\n');13; if (data.tryAgain) {; buf.push('  <button id="again-button" class="launch">\n    ', escape((14,  msg.tryAgain() )), '\n  </button>\n');16; }; buf.push('\n');17; if (data.nextLevel) {; buf.push('  <button id="continue-button" class="launch">\n    ', escape((18,  msg.continue() )), '\n  </button>\n');20; }; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],25:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<div class="generated-code-container">\n  <p class="generatedCodeMessage">', (2,  message ), '</p>\n  <pre class="generatedCode">', escape((3,  code )), '</pre>\n</div>\n\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],26:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common'); ; buf.push('\n\n<p class=\'dialog-title\'>', escape((3,  msg.puzzleTitle(locals) )), '</p>\n');4; if (locals.instructionImageUrl) {; buf.push('  <img class=\'instruction-image\' src=\'', escape((4,  locals.instructionImageUrl )), '\'>\n  <p class=\'instruction-with-image\'>', escape((5,  instructions )), '</p>\n');6; } else {; buf.push('  <p>', escape((6,  instructions )), '</p>\n');7; };; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],27:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common') ; buf.push('\n\n');3; var root = location.protocol + '//' + location.host.replace('learn\.', ''); 
; buf.push('\n\n<div id="learn">\n\n  <h1><a href="', escape((7,  root )), '">', escape((7,  msg.wantToLearn() )), '</a></h1>\n  <a href="', escape((8,  root )), '"><img id="learn-to-code" src="', escape((8,  BlocklyApps.assetUrl('media/promo.png') )), '"></a>\n  <a href="', escape((9,  root )), '">', escape((9,  msg.watchVideo() )), '</a>\n  <a href="', escape((10,  root )), '">', escape((10,  msg.tryHOC() )), '</a>\n  <a href="', escape((11,  location.protocol + '//' + location.host 
)), '">', escape((11,  msg.signup() )), '</a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],28:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common') ; buf.push('\n\n<div id="make-your-own">\n\n  <h1><a href=', escape((5,  data.makeUrl )), '>', escape((5,  data.makeString )), '</a></h1>\n  <a href=', escape((6,  data.makeUrl )), '><img src=', escape((6,  data.makeImage )), '></a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],29:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1;
  var msg = require('../../locale/pt_pt/common');
  var hideRunButton = locals.hideRunButton || false;
; buf.push('\n\n<div id="rotateContainer" style="background-image: url(', escape((6,  assetUrl('media/mobile_tutorial_turnphone.png') )), ')">\n  <div id="rotateText">\n    <p>', escape((8,  msg.rotateText() )), '<br>', escape((8,  msg.orientationLock() )), '</p>\n  </div>\n</div>\n\n');12; var instructions = function() {; buf.push('  <div id="bubble">\n    <img id="prompt-icon">\n    <p id="prompt">\n    </p>\n  </div>\n');17; };; buf.push('\n');18; // A spot for the server to inject some HTML for help content.
var helpArea = function(html) {; buf.push('  ');19; if (html) {; buf.push('    <div id="helpArea">\n      ', (20,  html ), '\n    </div>\n  ');22; }; buf.push('');22; };; buf.push('\n');23; var codeArea = function() {; buf.push('  <div id="codeTextbox" contenteditable spellcheck=false>\n    // ', escape((24,  msg.typeCode() )), '\n    <br>\n    // ', escape((26,  msg.typeHint() )), '\n    <br>\n  </div>\n');29; }; ; buf.push('\n\n<div id="visualization">\n  ', (32,  data.visualization ), '\n</div>\n\n<div id="belowVisualization">\n\n  <table id="gameButtons">\n    <tr>\n      <td style="width:100%;">\n        <button id="runButton" class="launch blocklyLaunch ', escape((40,  hideRunButton ? 'hide' : '')), '">\n          <div>', escape((41,  msg.runProgram() )), '</div>\n          <img src="', escape((42,  assetUrl('media/1x1.gif') )), '" class="run26"/>\n        </button>\n        <button id="resetButton" class="launch blocklyLaunch" style="display: none">\n          <div>', escape((45,  msg.resetProgram() )), '</div>\n          <img src="', escape((46,  assetUrl('media/1x1.gif') )), '" class="reset26"/>\n        </button>\n      </td>\n      ');49; if (data.controls) { ; buf.push('\n        ', (50,  data.controls ), '\n      ');51; } ; buf.push('\n    </tr>\n    ');53; if (data.extraControlRows) { ; buf.push('\n      ', (54,  data.extraControlRows ), '\n    ');55; } ; buf.push('\n  </table>\n\n  ');58; instructions() ; buf.push('\n  ');59; helpArea(data.helpHtml) ; buf.push('\n\n</div>\n\n<div id="blockly">\n  <div id="headers" dir="', escape((64,  data.localeDirection )), '">\n    <div id="toolbox-header" class="blockly-header"><span>', escape((65,  msg.toolboxHeader() )), '</span></div>\n    <div id="workspace-header" class="blockly-header">\n      <span id="blockCounter">', escape((67,  msg.workspaceHeader() )), '</span>\n      <div id="blockUsed" class=', escape((68,  data.blockCounterClass )), '>\n        ', escape((69,  data.blockUsed )), '\n      </div>\n      <span>&nbsp;/</span>\n      <span id="idealBlockNumber">', escape((72,  data.idealBlockNumber )), '</span>\n    </div>\n    <div id="show-code-header" class="blockly-header"><span>', escape((74,  msg.showCodeHeader() )), '</span></div>\n  </div>\n</div>\n\n<div class="clear"></div>\n\n');80; codeArea() ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],30:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<!DOCTYPE html>\n<html dir="', escape((2,  options.localeDirection )), '">\n<head>\n  <meta charset="utf-8">\n  <title>Blockly</title>\n  <script type="text/javascript" src="', escape((6,  assetUrl('js/' + options.locale + '/vendor.js') )), '"></script>\n  <script type="text/javascript" src="', escape((7,  assetUrl('js/' + options.locale + '/' + app + '.js') )), '"></script>\n  <script type="text/javascript">\n    ');9; // delay to onload to fix IE9. 
; buf.push('\n    window.onload = function() {\n      ', escape((11,  app )), 'Main(', (11, filters. json ( options )), ');\n    };\n  </script>\n</head>\n<body>\n  <div id="blockly"></div>\n  <style>\n    html, body {\n      background-color: #fff;\n      margin: 0;\n      padding:0;\n      overflow: hidden;\n      height: 100%;\n      font-family: \'Gotham A\', \'Gotham B\', sans-serif;\n    }\n    .blocklyText, .blocklyMenuText, .blocklyTreeLabel, .blocklyHtmlInput,\n        .blocklyIconMark, .blocklyTooltipText, .goog-menuitem-content {\n      font-family: \'Gotham A\', \'Gotham B\', sans-serif;\n    }\n    #blockly>svg {\n      border: none;\n    }\n    #blockly {\n      position: absolute;\n      top: 0;\n      left: 0;\n      overflow: hidden;\n      height: 100%;\n      width: 100%;\n    }\n  </style>\n</body>\n</html>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],31:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common'); ; buf.push('\n');2; if (options.feedbackImage) { ; buf.push('\n  <div class="sharing-image">\n    <img class="feedback-image" src="', escape((4,  options.feedbackImage )), '">\n  </div>\n');6; } ; buf.push('\n\n<div class="sharing">\n');9; if (options.alreadySaved) { ; buf.push('\n  <div class="saved-to-gallery">\n    ', escape((11,  msg.savedToGallery() )), '\n  </div>\n');13; } else if (options.saveToGalleryUrl) { ; buf.push('\n  <div class="social-buttons">\n  <button id="save-to-gallery-button" class="launch">\n    ', escape((16,  msg.saveToGallery() )), '\n  </button>\n  </div>\n');19; } ; buf.push('\n\n');21; if (options.response && options.response.level_source) { ; buf.push('\n  ');22; if (options.appStrings && options.appStrings.sharingText) { ; buf.push('\n    <div>', escape((23,  options.appStrings.sharingText )), '</div>\n  ');24; } ; buf.push('\n\n  <div>\n    <input type="text" id="sharing-input" value=', escape((27,  options.response.level_source )), ' readonly>\n  </div>\n\n  <div class=\'social-buttons\'>\n    ');31; if (options.facebookUrl) {; buf.push('      <a href=', escape((31,  options.facebookUrl )), ' target="_blank">\n        <img src=', escape((32,  BlocklyApps.assetUrl("media/facebook_purple.png") )), '>\n      </a>\n    ');34; }; buf.push('  \n    ');35; if (options.twitterUrl) {; buf.push('      <a href=', escape((35,  options.twitterUrl )), ' target="_blank">\n        <img src=', escape((36,  BlocklyApps.assetUrl("media/twitter_purple.png") )), ' >\n      </a>\n    ');38; }; buf.push('  </div>\n');39; } ; buf.push('\n</div>\n\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],32:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('');1; var msg = require('../../locale/pt_pt/common'); ; buf.push('\n\n<p id="num-lines-of-code" class="lines-of-code-message">\n  ', escape((4,  msg.numLinesOfCodeWritten({ numLines: numLinesWritten }) )), '\n  <button id="show-code-button" href="#">\n    ', escape((6,  msg.showGeneratedCode() )), '\n  </button>\n</p>\n\n');10; if (totalNumLinesWritten !== 0) { ; buf.push('\n  <p id="total-num-lines-of-code" class="lines-of-code-message">\n    ', escape((12,  msg.totalNumLinesOfCodeWritten({ numLines: totalNumLinesWritten }) )), '\n  </p>\n');14; } ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/pt_pt/common":36,"ejs":38}],33:[function(require,module,exports){
module.exports= (function() {
  var t = function anonymous(locals, filters, escape, rethrow) {
escape = escape || function (html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
var buf = [];
with (locals || {}) { (function(){ 
 buf.push('<div class=\'trophy\'><img class=\'trophyimg\' src=\'', escape((1,  img_url )), '\'><br>', escape((1,  concept_name )), '</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],34:[function(require,module,exports){
exports.shallowCopy = function(source) {
  var result = {};
  for (var prop in source) {
    result[prop] = source[prop];
  }

  return result;
};

/**
 * Returns a clone of the object, stripping any functions on it.
 */
exports.cloneWithoutFunctions = function(object) {
  return JSON.parse(JSON.stringify(object));
};

/**
 * Returns a new object with the properties from defaults overriden by any
 * properties in options. Leaves defaults and options unchanged.
 */
exports.extend = function(defaults, options) {
  var finalOptions = exports.shallowCopy(defaults);
  for (var prop in options) {
    finalOptions[prop] = options[prop];
  }

  return finalOptions;
};

exports.escapeHtml = function(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Version of modulo which, unlike javascript's `%` operator,
 * will always return a positive remainder.
 * @param number
 * @param mod
 */
exports.mod = function(number, mod) {
  return ((number % mod) + mod) % mod;
};

/**
 * Generates an array of integers from start to end inclusive
 */
exports.range = function(start, end) {
  var ints = [];
  for (var i = start; i <= end; i++) {
    ints.push(i);
  }
  return ints;
};

// Returns an array of required blocks by comparing a list of blocks with
// a list of app specific block tests (defined in <app>/requiredBlocks.js)
exports.parseRequiredBlocks = function(requiredBlocks, blockTests) {
  var blocksXml = xml.parseElement(requiredBlocks);

  var blocks = [];
  Array.prototype.forEach.call(blocksXml.children, function(block) {
    for (var testKey in blockTests) {
      var test = blockTests[testKey];
      if (typeof test === 'function') { test = test(); }
      if (test.type === block.getAttribute('type')) {
        blocks.push([test]);  // Test blocks get wrapped in an array.
        break;
      }
    }
  });

  return blocks;
};

/**
 * Given two functions, generates a function that returns the result of the
 * second function if and only if the first function returns true
 */
exports.executeIfConditional = function (conditional, fn) {
  return function () {
    if (conditional()) {
      return fn.apply(this, arguments);
    }
  };
};

},{}],35:[function(require,module,exports){
// Serializes an XML DOM node to a string.
exports.serialize = function(node) {
  var serializer = new XMLSerializer();
  return serializer.serializeToString(node);
};

// Parses a single root element string, wrapping it in an <xml/> element
exports.parseElement = function(text) {
  var parser = new DOMParser();
  text = text.trim();
  var dom = text.indexOf('<xml') === 0 ?
      parser.parseFromString(text, 'text/xml') :
      parser.parseFromString('<xml>' + text + '</xml>', 'text/xml');
  var errors = dom.getElementsByTagName("parsererror");
  var element = dom.firstChild;
  if (!element) {
    throw new Error('Nothing parsed');
  }
  if (errors.length > 0) {
    throw new Error(exports.serialize(errors[0]));
  }
  if (element !== dom.lastChild) {
    throw new Error('Parsed multiple elements');
  }
  return element;
};

},{}],36:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.pt=function(n){return n===1?"one":"other"}
exports.blocklyMessage = function(d){return "Blockly"};

exports.catActions = function(d){return "Ações"};

exports.catColour = function(d){return "Cor"};

exports.catLogic = function(d){return "Lógica"};

exports.catLists = function(d){return "Listas"};

exports.catLoops = function(d){return "Ciclos"};

exports.catMath = function(d){return "Matemática"};

exports.catProcedures = function(d){return "Funções"};

exports.catText = function(d){return "Texto"};

exports.catVariables = function(d){return "Variáveis"};

exports.codeTooltip = function(d){return "Vê o código gerado em Javascript."};

exports.continue = function(d){return "Continuar"};

exports.dialogCancel = function(d){return "Cancelar"};

exports.dialogOK = function(d){return "OK"};

exports.directionNorthLetter = function(d){return "N"};

exports.directionSouthLetter = function(d){return "S"};

exports.directionEastLetter = function(d){return "E"};

exports.directionWestLetter = function(d){return "W"};

exports.end = function(d){return "end"};

exports.emptyBlocksErrorMsg = function(d){return "Os blocos \"Repetir\" ou \"Se\" precisam de incluir blocos dentro para funcionar. Garante que o bloco interno encaixa correctamente dentro do bloco que o contém."};

exports.extraTopBlocks = function(d){return "Tens blocos extras que não estão ligados a um bloco de evento."};

exports.finalStage = function(d){return "Parabéns! Completaste a etapa final."};

exports.finalStageTrophies = function(d){return "Parabéns! Completaste a etapa final e ganhaste "+p(d,"numTrophies",0,"pt",{"one":"troféu","other":n(d,"numTrophies")+" troféus"})+"."};

exports.generatedCodeInfo = function(d){return "Mesmo as melhores universidades ensinam código em blocos (por exemplo, "+v(d,"berkeleyLink")+", "+v(d,"harvardLink")+"). Mas na verdade, os blocos que juntaste podem ser vistos em JavaScript, a linguagem de código mais usada em todo o mundo:"};

exports.hashError = function(d){return "Desculpa, '%1' não corresponde a qualquer programa gravado."};

exports.help = function(d){return "Ajuda"};

exports.hintTitle = function(d){return "Dica:"};

exports.jump = function(d){return "jump"};

exports.levelIncompleteError = function(d){return "Estás a usar todos os tipos necessários de blocos, mas não da forma certa."};

exports.listVariable = function(d){return "lista"};

exports.makeYourOwnFlappy = function(d){return "Cria o teu próprio jogo Flappy"};

exports.missingBlocksErrorMsg = function(d){return "Tenta um ou mais blocos dos seguintes para resolver o puzzle."};

exports.nextLevel = function(d){return "Parabéns! Completaste o puzzle "+v(d,"puzzleNumber")+"."};

exports.nextLevelTrophies = function(d){return "Parabéns! Completaste o puzzle "+v(d,"puzzleNumber")+" e ganhaste "+p(d,"numTrophies",0,"pt",{"one":"troféu","other":n(d,"numTrophies")+" troféus"})+"."};

exports.nextStage = function(d){return "Parabéns! Completaste "+v(d,"stageName")+"."};

exports.nextStageTrophies = function(d){return "Parabéns! Completaste "+v(d,"stageName")+" e ganhaste "+p(d,"numTrophies",0,"pt",{"one":"a trophy","other":n(d,"numTrophies")+" trophies"})+"."};

exports.numBlocksNeeded = function(d){return "Parabéns! Completaste o puzzle "+v(d,"puzzleNumber")+". (Apesar disso, poderias ter usado somente "+p(d,"numBlocks",0,"pt",{"one":"1 bloco","other":n(d,"numBlocks")+" blocos"})+".)"};

exports.numLinesOfCodeWritten = function(d){return "Acabaste de escrever "+p(d,"numLines",0,"pt",{"one":"1 linha","other":n(d,"numLines")+" linhas"})+" de código!"};

exports.puzzleTitle = function(d){return "Puzzle "+v(d,"puzzle_number")+" de "+v(d,"stage_total")};

exports.resetProgram = function(d){return "Repor"};

exports.runProgram = function(d){return "Executa o programa"};

exports.runTooltip = function(d){return "Executa o programa definido pelos blocos na área de trabalho."};

exports.showCodeHeader = function(d){return "Mostrar o Código"};

exports.showGeneratedCode = function(d){return "Mostrar o código"};

exports.subtitle = function(d){return "um ambiente de programação visual"};

exports.textVariable = function(d){return "texto"};

exports.tooFewBlocksMsg = function(d){return "Estás a usar todos os tipos de blocos necessários, mas tenta usar mais alguns desses blocos para completar este puzzle."};

exports.tooManyBlocksMsg = function(d){return "Este puzzle pode ser resolvido com <x id='START_SPAN'/><x id='END_SPAN'/> blocos."};

exports.tooMuchWork = function(d){return "Fizeste-me ter muito trabalho! Podes tentar repetir menos vezes?"};

exports.flappySpecificFail = function(d){return "O teu código parece bem - vai agitar-se com cada clique. Mas precisas de clicar várias vezes para agitar-se até ao alvo."};

exports.toolboxHeader = function(d){return "Blocos"};

exports.openWorkspace = function(d){return "Como funciona"};

exports.totalNumLinesOfCodeWritten = function(d){return "Total de todos os tempos: "+p(d,"numLines",0,"pt",{"one":"1 linha","other":n(d,"numLines")+" linhas"})+" de código."};

exports.tryAgain = function(d){return "Tentar novamente"};

exports.backToPreviousLevel = function(d){return "Voltar ao nível anterior"};

exports.saveToGallery = function(d){return "Guarda na tua galeria de imagens"};

exports.savedToGallery = function(d){return "Saved to your gallery!"};

exports.typeCode = function(d){return "Coloca o teu código Javascript abaixo destas instruções."};

exports.typeFuncs = function(d){return "Funções disponíveis:%1"};

exports.typeHint = function(d){return "Repara que os parêntesis e ponto e vírgula são necessários."};

exports.workspaceHeader = function(d){return "Monta os teus blocos aqui: "};

exports.infinity = function(d){return "Infinito"};

exports.rotateText = function(d){return "Roda o teu dispositivo."};

exports.orientationLock = function(d){return "Desativa o bloqueio de orientação em configurações do dispositivo."};

exports.wantToLearn = function(d){return "Queres aprender a programar com código?"};

exports.watchVideo = function(d){return "Vê o vídeo"};

exports.when = function(d){return "when"};

exports.tryHOC = function(d){return "Exprimenta a Hora do Código"};

exports.signup = function(d){return "Inscreve-te para o curso de introdução"};

exports.hintHeader = function(d){return "Aqui vai uma dica:"};


},{"messageformat":49}],37:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.pt=function(n){return n===1?"one":"other"}
exports.catActions = function(d){return "Actions"};

exports.catControl = function(d){return "Loops"};

exports.catEvents = function(d){return "Events"};

exports.catLogic = function(d){return "Logic"};

exports.catMath = function(d){return "Math"};

exports.catProcedures = function(d){return "Functions"};

exports.catText = function(d){return "Text"};

exports.catVariables = function(d){return "Variables"};

exports.continue = function(d){return "Continua"};

exports.defaultSayText = function(d){return "type here"};

exports.finalLevel = function(d){return "Parabéns! Resolveste o puzzle final."};

exports.incrementOpponentScore = function(d){return "marca o ponto do oponente"};

exports.incrementScoreTooltip = function(d){return "Adiciona um para a pontuação do jogador ou do oponente."};

exports.incrementPlayerScore = function(d){return "marca ponto de jogador"};

exports.makeYourOwn = function(d){return "Faz a tua própria história"};

exports.moveDirectionDown = function(d){return "down"};

exports.moveDirectionLeft = function(d){return "left"};

exports.moveDirectionRight = function(d){return "right"};

exports.moveDirectionUp = function(d){return "up"};

exports.moveDirectionRandom = function(d){return "random"};

exports.moveDistance25 = function(d){return "25 pixels"};

exports.moveDistance50 = function(d){return "50 pixels"};

exports.moveDistance100 = function(d){return "100 pixels"};

exports.moveDistance200 = function(d){return "200 pixels"};

exports.moveDistance400 = function(d){return "400 pixels"};

exports.moveDistancePixels = function(d){return "pixels"};

exports.moveDistanceRandom = function(d){return "random pixels"};

exports.moveDistanceTooltip = function(d){return "Move a character a specific distance in the specified direction."};

exports.moveSprite = function(d){return "move"};

exports.moveSprite1 = function(d){return "move character 1"};

exports.moveSprite2 = function(d){return "move character 2"};

exports.moveSprite3 = function(d){return "move character 3"};

exports.moveSprite4 = function(d){return "move character 4"};

exports.moveSprite5 = function(d){return "move character 5"};

exports.moveSprite6 = function(d){return "move character 6"};

exports.moveDown = function(d){return "move para baixo"};

exports.moveDownTooltip = function(d){return "Move the paddle down."};

exports.moveLeft = function(d){return "move para a esquerda"};

exports.moveLeftTooltip = function(d){return "Move the paddle to the left."};

exports.moveRight = function(d){return "move para a direita"};

exports.moveRightTooltip = function(d){return "Move the paddle to the right."};

exports.moveUp = function(d){return "move para cima"};

exports.moveUpTooltip = function(d){return "Move the paddle up."};

exports.moveTooltip = function(d){return "Move a character."};

exports.nextLevel = function(d){return "Parabéns! Completaste este puzzle."};

exports.no = function(d){return "Não"};

exports.numBlocksNeeded = function(d){return "Este puzzle pode ser resolvido com blocos de  %1 ."};

exports.oneTopBlock = function(d){return "Para este puzzle, precisas de empilhar todos os blocos da área de trabalho branca."};

exports.playSoundCrunch = function(d){return "play crunch sound"};

exports.playSoundGoal1 = function(d){return "tocar som do objetivo 1"};

exports.playSoundGoal2 = function(d){return "tocar som do objetivo 2"};

exports.playSoundHit = function(d){return "play hit sound"};

exports.playSoundLosePoint = function(d){return "tocar som de ponto perdido"};

exports.playSoundLosePoint2 = function(d){return "tocar som de ponto perdido 2"};

exports.playSoundRetro = function(d){return "play retro sound"};

exports.playSoundRubber = function(d){return "tocar som de borracha"};

exports.playSoundSlap = function(d){return "tocar som de chapada"};

exports.playSoundTooltip = function(d){return "Tocar o som escolhido."};

exports.playSoundWinPoint = function(d){return "tocar som de ponto ganho"};

exports.playSoundWinPoint2 = function(d){return "tocar som de ponto ganho 2"};

exports.playSoundWood = function(d){return "tocar som de madeira"};

exports.positionTopLeft = function(d){return "to the top left position"};

exports.positionTopCenter = function(d){return "to the top center position"};

exports.positionTopRight = function(d){return "to the top right position"};

exports.positionMiddleLeft = function(d){return "to the middle left position"};

exports.positionMiddleCenter = function(d){return "to the middle center position"};

exports.positionMiddleRight = function(d){return "to the middle right position"};

exports.positionBottomLeft = function(d){return "to the bottom left position"};

exports.positionBottomCenter = function(d){return "to the bottom center position"};

exports.positionBottomRight = function(d){return "to the bottom right position"};

exports.positionRandom = function(d){return "to the random position"};

exports.reinfFeedbackMsg = function(d){return "You can press the \"Try again\" button to go back to playing your story."};

exports.repeatForever = function(d){return "repeat forever"};

exports.repeatDo = function(d){return "do"};

exports.repeatForeverTooltip = function(d){return "Execute the actions in this block repeatedly while the story is running."};

exports.saySprite = function(d){return "say"};

exports.saySprite1 = function(d){return "character 1 say"};

exports.saySprite2 = function(d){return "character 2 say"};

exports.saySprite3 = function(d){return "character 3 say"};

exports.saySprite4 = function(d){return "character 4 say"};

exports.saySprite5 = function(d){return "character 5 say"};

exports.saySprite6 = function(d){return "character 6 say"};

exports.saySpriteTooltip = function(d){return "Pop up a speech bubble with the associated text from the specified character."};

exports.scoreText = function(d){return "Score: "+v(d,"playerScore")+" : "+v(d,"opponentScore")};

exports.setBackgroundRandom = function(d){return "set random scene"};

exports.setBackgroundBlack = function(d){return "set black background"};

exports.setBackgroundCave = function(d){return "set cave background"};

exports.setBackgroundCloudy = function(d){return "set cloudy background"};

exports.setBackgroundHardcourt = function(d){return "set hardcourt scene"};

exports.setBackgroundNight = function(d){return "set night background"};

exports.setBackgroundUnderwater = function(d){return "set underwater background"};

exports.setBackgroundTooltip = function(d){return "Sets the background image"};

exports.setScoreText = function(d){return "set score"};

exports.setScoreTextTooltip = function(d){return "Sets the text to be displayed in the score area."};

exports.setSpriteEmotionAngry = function(d){return "to a angry emotion"};

exports.setSpriteEmotionHappy = function(d){return "to a happy emotion"};

exports.setSpriteEmotionNormal = function(d){return "to a normal emotion"};

exports.setSpriteEmotionRandom = function(d){return "to a random emotion"};

exports.setSpriteEmotionSad = function(d){return "to a sad emotion"};

exports.setSpriteEmotionTooltip = function(d){return "Sets the actor emotion"};

exports.setSpriteCat = function(d){return "to a cat image"};

exports.setSpriteDinosaur = function(d){return "to a dinosaur image"};

exports.setSpriteDog = function(d){return "to a dog image"};

exports.setSpriteHidden = function(d){return "to a hidden image"};

exports.setSpriteHideK1 = function(d){return "hide"};

exports.setSpriteOctopus = function(d){return "to an octopus image"};

exports.setSpritePenguin = function(d){return "to a penguin image"};

exports.setSpriteRandom = function(d){return "to a random image"};

exports.setSpriteShowK1 = function(d){return "show"};

exports.setSpriteWitch = function(d){return "to a witch image"};

exports.setSpritePositionTooltip = function(d){return "Instantly moves an actor to the specified location."};

exports.setSpriteK1Tooltip = function(d){return "Shows or hides the specified actor."};

exports.setSpriteTooltip = function(d){return "Sets the character image"};

exports.setSpriteSpeedRandom = function(d){return "to a random speed"};

exports.setSpriteSpeedVerySlow = function(d){return "to a very slow speed"};

exports.setSpriteSpeedSlow = function(d){return "to a slow speed"};

exports.setSpriteSpeedNormal = function(d){return "to a normal speed"};

exports.setSpriteSpeedFast = function(d){return "to a fast speed"};

exports.setSpriteSpeedVeryFast = function(d){return "to a very fast speed"};

exports.setSpriteSpeedTooltip = function(d){return "Sets the speed of a character"};

exports.share = function(d){return "Share"};

exports.shareStudioTwitter = function(d){return "Check out the story I made. I wrote it myself with @codeorg"};

exports.shareGame = function(d){return "Share your story:"};

exports.showTitleScreen = function(d){return "show title screen"};

exports.showTitleScreenTitle = function(d){return "title"};

exports.showTitleScreenText = function(d){return "text"};

exports.showTSDefTitle = function(d){return "type title here"};

exports.showTSDefText = function(d){return "type text here"};

exports.showTitleScreenTooltip = function(d){return "Show a title screen with the associated title and text."};

exports.setSprite = function(d){return "set"};

exports.setSprite1 = function(d){return "set character 1"};

exports.setSprite2 = function(d){return "set character 2"};

exports.setSprite3 = function(d){return "set character 3"};

exports.setSprite4 = function(d){return "set character 4"};

exports.setSprite5 = function(d){return "set character 5"};

exports.setSprite6 = function(d){return "set character 6"};

exports.sprite1 = function(d){return "actor 1"};

exports.sprite2 = function(d){return "actor 2"};

exports.sprite3 = function(d){return "actor 3"};

exports.sprite4 = function(d){return "actor 4"};

exports.sprite5 = function(d){return "actor 5"};

exports.sprite6 = function(d){return "actor 6"};

exports.stopSprite = function(d){return "stop"};

exports.stopSprite1 = function(d){return "stop actor 1"};

exports.stopSprite2 = function(d){return "stop actor 2"};

exports.stopSprite3 = function(d){return "stop actor 3"};

exports.stopSprite4 = function(d){return "stop actor 4"};

exports.stopSprite5 = function(d){return "stop actor 5"};

exports.stopSprite6 = function(d){return "stop actor 6"};

exports.stopTooltip = function(d){return "Stops an actor's movement."};

exports.waitFor = function(d){return "wait for"};

exports.waitSeconds = function(d){return "seconds"};

exports.waitForClick = function(d){return "wait for click"};

exports.waitForRandom = function(d){return "wait for random"};

exports.waitForHalfSecond = function(d){return "wait for a half second"};

exports.waitFor1Second = function(d){return "wait for 1 second"};

exports.waitFor2Seconds = function(d){return "wait for 2 seconds"};

exports.waitFor5Seconds = function(d){return "wait for 5 seconds"};

exports.waitFor10Seconds = function(d){return "wait for 10 seconds"};

exports.waitParamsTooltip = function(d){return "Waits for a specified number of seconds or use zero to wait until a click occurs."};

exports.waitTooltip = function(d){return "Waits for a specified amount of time or until a click occurs."};

exports.whenDown = function(d){return "when Down arrow"};

exports.whenDownTooltip = function(d){return "Execute the actions below when the Down arrow button is pressed."};

exports.whenGameStarts = function(d){return "when game starts"};

exports.whenGameStartsTooltip = function(d){return "Execute the actions below when the game starts."};

exports.whenLeft = function(d){return "when Left arrow"};

exports.whenLeftTooltip = function(d){return "Execute the actions below when the Left arrow button is pressed."};

exports.whenRight = function(d){return "when Right arrow"};

exports.whenRightTooltip = function(d){return "Execute the actions below when the Right arrow button is pressed."};

exports.whenSpriteClicked = function(d){return "when actor clicked"};

exports.whenSpriteClicked1 = function(d){return "when character 1 clicked"};

exports.whenSpriteClicked2 = function(d){return "when character 2 clicked"};

exports.whenSpriteClicked3 = function(d){return "when character 3 clicked"};

exports.whenSpriteClicked4 = function(d){return "when character 4 clicked"};

exports.whenSpriteClicked5 = function(d){return "when character 5 clicked"};

exports.whenSpriteClicked6 = function(d){return "when character 6 clicked"};

exports.whenSpriteClickedTooltip = function(d){return "Execute the actions below when a character is clicked."};

exports.whenSpriteCollided1 = function(d){return "when character 1"};

exports.whenSpriteCollided2 = function(d){return "when character 2"};

exports.whenSpriteCollided3 = function(d){return "when character 3"};

exports.whenSpriteCollided4 = function(d){return "when character 4"};

exports.whenSpriteCollided5 = function(d){return "when character 5"};

exports.whenSpriteCollided6 = function(d){return "when character 6"};

exports.whenSpriteCollidedTooltip = function(d){return "Execute the actions below when a character touches another character."};

exports.whenSpriteCollidedWith1 = function(d){return "touches character 1"};

exports.whenSpriteCollidedWith2 = function(d){return "touches character 2"};

exports.whenSpriteCollidedWith3 = function(d){return "touches character 3"};

exports.whenSpriteCollidedWith4 = function(d){return "touches character 4"};

exports.whenSpriteCollidedWith5 = function(d){return "touches character 5"};

exports.whenSpriteCollidedWith6 = function(d){return "touches character 6"};

exports.whenUp = function(d){return "when Up arrow"};

exports.whenUpTooltip = function(d){return "Execute the actions below when the Up arrow button is pressed."};

exports.yes = function(d){return "Sim"};


},{"messageformat":49}],38:[function(require,module,exports){

/*!
 * EJS
 * Copyright(c) 2012 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var utils = require('./utils')
  , path = require('path')
  , dirname = path.dirname
  , extname = path.extname
  , join = path.join
  , fs = require('fs')
  , read = fs.readFileSync;

/**
 * Filters.
 *
 * @type Object
 */

var filters = exports.filters = require('./filters');

/**
 * Intermediate js cache.
 *
 * @type Object
 */

var cache = {};

/**
 * Clear intermediate js cache.
 *
 * @api public
 */

exports.clearCache = function(){
  cache = {};
};

/**
 * Translate filtered code into function calls.
 *
 * @param {String} js
 * @return {String}
 * @api private
 */

function filtered(js) {
  return js.substr(1).split('|').reduce(function(js, filter){
    var parts = filter.split(':')
      , name = parts.shift()
      , args = parts.join(':') || '';
    if (args) args = ', ' + args;
    return 'filters.' + name + '(' + js + args + ')';
  });
};

/**
 * Re-throw the given `err` in context to the
 * `str` of ejs, `filename`, and `lineno`.
 *
 * @param {Error} err
 * @param {String} str
 * @param {String} filename
 * @param {String} lineno
 * @api private
 */

function rethrow(err, str, filename, lineno){
  var lines = str.split('\n')
    , start = Math.max(lineno - 3, 0)
    , end = Math.min(lines.length, lineno + 3);

  // Error context
  var context = lines.slice(start, end).map(function(line, i){
    var curr = i + start + 1;
    return (curr == lineno ? ' >> ' : '    ')
      + curr
      + '| '
      + line;
  }).join('\n');

  // Alter exception message
  err.path = filename;
  err.message = (filename || 'ejs') + ':'
    + lineno + '\n'
    + context + '\n\n'
    + err.message;
  
  throw err;
}

/**
 * Parse the given `str` of ejs, returning the function body.
 *
 * @param {String} str
 * @return {String}
 * @api public
 */

var parse = exports.parse = function(str, options){
  var options = options || {}
    , open = options.open || exports.open || '<%'
    , close = options.close || exports.close || '%>'
    , filename = options.filename
    , compileDebug = options.compileDebug !== false
    , buf = "";

  buf += 'var buf = [];';
  if (false !== options._with) buf += '\nwith (locals || {}) { (function(){ ';
  buf += '\n buf.push(\'';

  var lineno = 1;

  var consumeEOL = false;
  for (var i = 0, len = str.length; i < len; ++i) {
    var stri = str[i];
    if (str.slice(i, open.length + i) == open) {
      i += open.length
  
      var prefix, postfix, line = (compileDebug ? '__stack.lineno=' : '') + lineno;
      switch (str[i]) {
        case '=':
          prefix = "', escape((" + line + ', ';
          postfix = ")), '";
          ++i;
          break;
        case '-':
          prefix = "', (" + line + ', ';
          postfix = "), '";
          ++i;
          break;
        default:
          prefix = "');" + line + ';';
          postfix = "; buf.push('";
      }

      var end = str.indexOf(close, i)
        , js = str.substring(i, end)
        , start = i
        , include = null
        , n = 0;

      if ('-' == js[js.length-1]){
        js = js.substring(0, js.length - 2);
        consumeEOL = true;
      }

      if (0 == js.trim().indexOf('include')) {
        var name = js.trim().slice(7).trim();
        if (!filename) throw new Error('filename option is required for includes');
        var path = resolveInclude(name, filename);
        include = read(path, 'utf8');
        include = exports.parse(include, { filename: path, _with: false, open: open, close: close, compileDebug: compileDebug });
        buf += "' + (function(){" + include + "})() + '";
        js = '';
      }

      while (~(n = js.indexOf("\n", n))) n++, lineno++;
      if (js.substr(0, 1) == ':') js = filtered(js);
      if (js) {
        if (js.lastIndexOf('//') > js.lastIndexOf('\n')) js += '\n';
        buf += prefix;
        buf += js;
        buf += postfix;
      }
      i += end - start + close.length - 1;

    } else if (stri == "\\") {
      buf += "\\\\";
    } else if (stri == "'") {
      buf += "\\'";
    } else if (stri == "\r") {
      // ignore
    } else if (stri == "\n") {
      if (consumeEOL) {
        consumeEOL = false;
      } else {
        buf += "\\n";
        lineno++;
      }
    } else {
      buf += stri;
    }
  }

  if (false !== options._with) buf += "'); })();\n} \nreturn buf.join('');";
  else buf += "');\nreturn buf.join('');";
  return buf;
};

/**
 * Compile the given `str` of ejs into a `Function`.
 *
 * @param {String} str
 * @param {Object} options
 * @return {Function}
 * @api public
 */

var compile = exports.compile = function(str, options){
  options = options || {};
  var escape = options.escape || utils.escape;
  
  var input = JSON.stringify(str)
    , compileDebug = options.compileDebug !== false
    , client = options.client
    , filename = options.filename
        ? JSON.stringify(options.filename)
        : 'undefined';
  
  if (compileDebug) {
    // Adds the fancy stack trace meta info
    str = [
      'var __stack = { lineno: 1, input: ' + input + ', filename: ' + filename + ' };',
      rethrow.toString(),
      'try {',
      exports.parse(str, options),
      '} catch (err) {',
      '  rethrow(err, __stack.input, __stack.filename, __stack.lineno);',
      '}'
    ].join("\n");
  } else {
    str = exports.parse(str, options);
  }
  
  if (options.debug) console.log(str);
  if (client) str = 'escape = escape || ' + escape.toString() + ';\n' + str;

  try {
    var fn = new Function('locals, filters, escape, rethrow', str);
  } catch (err) {
    if ('SyntaxError' == err.name) {
      err.message += options.filename
        ? ' in ' + filename
        : ' while compiling ejs';
    }
    throw err;
  }

  if (client) return fn;

  return function(locals){
    return fn.call(this, locals, filters, escape, rethrow);
  }
};

/**
 * Render the given `str` of ejs.
 *
 * Options:
 *
 *   - `locals`          Local variables object
 *   - `cache`           Compiled functions are cached, requires `filename`
 *   - `filename`        Used by `cache` to key caches
 *   - `scope`           Function execution context
 *   - `debug`           Output generated function body
 *   - `open`            Open tag, defaulting to "<%"
 *   - `close`           Closing tag, defaulting to "%>"
 *
 * @param {String} str
 * @param {Object} options
 * @return {String}
 * @api public
 */

exports.render = function(str, options){
  var fn
    , options = options || {};

  if (options.cache) {
    if (options.filename) {
      fn = cache[options.filename] || (cache[options.filename] = compile(str, options));
    } else {
      throw new Error('"cache" option requires "filename".');
    }
  } else {
    fn = compile(str, options);
  }

  options.__proto__ = options.locals;
  return fn.call(options.scope, options);
};

/**
 * Render an EJS file at the given `path` and callback `fn(err, str)`.
 *
 * @param {String} path
 * @param {Object|Function} options or callback
 * @param {Function} fn
 * @api public
 */

exports.renderFile = function(path, options, fn){
  var key = path + ':string';

  if ('function' == typeof options) {
    fn = options, options = {};
  }

  options.filename = path;

  var str;
  try {
    str = options.cache
      ? cache[key] || (cache[key] = read(path, 'utf8'))
      : read(path, 'utf8');
  } catch (err) {
    fn(err);
    return;
  }
  fn(null, exports.render(str, options));
};

/**
 * Resolve include `name` relative to `filename`.
 *
 * @param {String} name
 * @param {String} filename
 * @return {String}
 * @api private
 */

function resolveInclude(name, filename) {
  var path = join(dirname(filename), name);
  var ext = extname(name);
  if (!ext) path += '.ejs';
  return path;
}

// express support

exports.__express = exports.renderFile;

/**
 * Expose to require().
 */

if (require.extensions) {
  require.extensions['.ejs'] = function (module, filename) {
    filename = filename || module.filename;
    var options = { filename: filename, client: true }
      , template = fs.readFileSync(filename).toString()
      , fn = compile(template, options);
    module._compile('module.exports = ' + fn.toString() + ';', filename);
  };
} else if (require.registerExtension) {
  require.registerExtension('.ejs', function(src) {
    return compile(src, {});
  });
}

},{"./filters":39,"./utils":40,"fs":41,"path":43}],39:[function(require,module,exports){
/*!
 * EJS - Filters
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * First element of the target `obj`.
 */

exports.first = function(obj) {
  return obj[0];
};

/**
 * Last element of the target `obj`.
 */

exports.last = function(obj) {
  return obj[obj.length - 1];
};

/**
 * Capitalize the first letter of the target `str`.
 */

exports.capitalize = function(str){
  str = String(str);
  return str[0].toUpperCase() + str.substr(1, str.length);
};

/**
 * Downcase the target `str`.
 */

exports.downcase = function(str){
  return String(str).toLowerCase();
};

/**
 * Uppercase the target `str`.
 */

exports.upcase = function(str){
  return String(str).toUpperCase();
};

/**
 * Sort the target `obj`.
 */

exports.sort = function(obj){
  return Object.create(obj).sort();
};

/**
 * Sort the target `obj` by the given `prop` ascending.
 */

exports.sort_by = function(obj, prop){
  return Object.create(obj).sort(function(a, b){
    a = a[prop], b = b[prop];
    if (a > b) return 1;
    if (a < b) return -1;
    return 0;
  });
};

/**
 * Size or length of the target `obj`.
 */

exports.size = exports.length = function(obj) {
  return obj.length;
};

/**
 * Add `a` and `b`.
 */

exports.plus = function(a, b){
  return Number(a) + Number(b);
};

/**
 * Subtract `b` from `a`.
 */

exports.minus = function(a, b){
  return Number(a) - Number(b);
};

/**
 * Multiply `a` by `b`.
 */

exports.times = function(a, b){
  return Number(a) * Number(b);
};

/**
 * Divide `a` by `b`.
 */

exports.divided_by = function(a, b){
  return Number(a) / Number(b);
};

/**
 * Join `obj` with the given `str`.
 */

exports.join = function(obj, str){
  return obj.join(str || ', ');
};

/**
 * Truncate `str` to `len`.
 */

exports.truncate = function(str, len, append){
  str = String(str);
  if (str.length > len) {
    str = str.slice(0, len);
    if (append) str += append;
  }
  return str;
};

/**
 * Truncate `str` to `n` words.
 */

exports.truncate_words = function(str, n){
  var str = String(str)
    , words = str.split(/ +/);
  return words.slice(0, n).join(' ');
};

/**
 * Replace `pattern` with `substitution` in `str`.
 */

exports.replace = function(str, pattern, substitution){
  return String(str).replace(pattern, substitution || '');
};

/**
 * Prepend `val` to `obj`.
 */

exports.prepend = function(obj, val){
  return Array.isArray(obj)
    ? [val].concat(obj)
    : val + obj;
};

/**
 * Append `val` to `obj`.
 */

exports.append = function(obj, val){
  return Array.isArray(obj)
    ? obj.concat(val)
    : obj + val;
};

/**
 * Map the given `prop`.
 */

exports.map = function(arr, prop){
  return arr.map(function(obj){
    return obj[prop];
  });
};

/**
 * Reverse the given `obj`.
 */

exports.reverse = function(obj){
  return Array.isArray(obj)
    ? obj.reverse()
    : String(obj).split('').reverse().join('');
};

/**
 * Get `prop` of the given `obj`.
 */

exports.get = function(obj, prop){
  return obj[prop];
};

/**
 * Packs the given `obj` into json string
 */
exports.json = function(obj){
  return JSON.stringify(obj);
};

},{}],40:[function(require,module,exports){

/*!
 * EJS
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Escape the given string of `html`.
 *
 * @param {String} html
 * @return {String}
 * @api private
 */

exports.escape = function(html){
  return String(html)
    .replace(/&(?!#?[a-zA-Z0-9]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');
};
 

},{}],41:[function(require,module,exports){

},{}],42:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],43:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require("/home/ubuntu/website-ci/blockly/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/home/ubuntu/website-ci/blockly/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":42}],44:[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],45:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],46:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],47:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":45,"./encode":46}],48:[function(require,module,exports){
/*jshint strict:true node:true es5:true onevar:true laxcomma:true laxbreak:true eqeqeq:true immed:true latedef:true*/
(function () {
  "use strict";

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '~', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(delims),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#']
      .concat(unwise).concat(autoEscape),
    nonAuthChars = ['/', '@', '?', '#'].concat(delims),
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-zA-Z0-9][a-z0-9A-Z_-]{0,62}$/,
    hostnamePartStart = /^([a-zA-Z0-9][a-z0-9A-Z_-]{0,62})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always have a path component.
    pathedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && typeof(url) === 'object' && url.href) return url;

  if (typeof url !== 'string') {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var out = {},
      rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    out.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      out.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {
    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    // don't enforce full RFC correctness, just be unstupid about it.

    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the first @ sign, unless some non-auth character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    var atSign = rest.indexOf('@');
    if (atSign !== -1) {
      var auth = rest.slice(0, atSign);

      // there *may be* an auth
      var hasAuth = true;
      for (var i = 0, l = nonAuthChars.length; i < l; i++) {
        if (auth.indexOf(nonAuthChars[i]) !== -1) {
          // not a valid auth.  Something like http://foo.com/bar@baz/
          hasAuth = false;
          break;
        }
      }

      if (hasAuth) {
        // pluck off the auth portion.
        out.auth = decodeURIComponent(auth);
        rest = rest.substr(atSign + 1);
      }
    }

    var firstNonHost = -1;
    for (var i = 0, l = nonHostChars.length; i < l; i++) {
      var index = rest.indexOf(nonHostChars[i]);
      if (index !== -1 &&
          (firstNonHost < 0 || index < firstNonHost)) firstNonHost = index;
    }

    if (firstNonHost !== -1) {
      out.host = rest.substr(0, firstNonHost);
      rest = rest.substr(firstNonHost);
    } else {
      out.host = rest;
      rest = '';
    }

    // pull out port.
    var p = parseHost(out.host);
    var keys = Object.keys(p);
    for (var i = 0, l = keys.length; i < l; i++) {
      var key = keys[i];
      out[key] = p[key];
    }

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    out.hostname = out.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = out.hostname[0] === '[' &&
        out.hostname[out.hostname.length - 1] === ']';

    // validate a little.
    if (out.hostname.length > hostnameMaxLen) {
      out.hostname = '';
    } else if (!ipv6Hostname) {
      var hostparts = out.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            out.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    // hostnames are always lower case.
    out.hostname = out.hostname.toLowerCase();

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = out.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      out.hostname = newOut.join('.');
    }

    out.host = (out.hostname || '') +
        ((out.port) ? ':' + out.port : '');
    out.href += out.host;

    // strip [ and ] from the hostname
    if (ipv6Hostname) {
      out.hostname = out.hostname.substr(1, out.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    out.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    out.search = rest.substr(qm);
    out.query = rest.substr(qm + 1);
    if (parseQueryString) {
      out.query = querystring.parse(out.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    out.search = '';
    out.query = {};
  }
  if (rest) out.pathname = rest;
  if (slashedProtocol[proto] &&
      out.hostname && !out.pathname) {
    out.pathname = '/';
  }

  //to support http.request
  if (out.pathname || out.search) {
    out.path = (out.pathname ? out.pathname : '') +
               (out.search ? out.search : '');
  }

  // finally, reconstruct the href based on what has been validated.
  out.href = urlFormat(out);
  return out;
}

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (typeof(obj) === 'string') obj = urlParse(obj);

  var auth = obj.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = obj.protocol || '',
      pathname = obj.pathname || '',
      hash = obj.hash || '',
      host = false,
      query = '';

  if (obj.host !== undefined) {
    host = auth + obj.host;
  } else if (obj.hostname !== undefined) {
    host = auth + (obj.hostname.indexOf(':') === -1 ?
        obj.hostname :
        '[' + obj.hostname + ']');
    if (obj.port) {
      host += ':' + obj.port;
    }
  }

  if (obj.query && typeof obj.query === 'object' &&
      Object.keys(obj.query).length) {
    query = querystring.stringify(obj.query);
  }

  var search = obj.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (obj.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  return protocol + host + pathname + search + hash;
}

function urlResolve(source, relative) {
  return urlFormat(urlResolveObject(source, relative));
}

function urlResolveObject(source, relative) {
  if (!source) return relative;

  source = urlParse(urlFormat(source), false, true);
  relative = urlParse(urlFormat(relative), false, true);

  // hash is always overridden, no matter what.
  source.hash = relative.hash;

  if (relative.href === '') {
    source.href = urlFormat(source);
    return source;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    relative.protocol = source.protocol;
    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[relative.protocol] &&
        relative.hostname && !relative.pathname) {
      relative.path = relative.pathname = '/';
    }
    relative.href = urlFormat(relative);
    return relative;
  }

  if (relative.protocol && relative.protocol !== source.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      relative.href = urlFormat(relative);
      return relative;
    }
    source.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      relative.pathname = relPath.join('/');
    }
    source.pathname = relative.pathname;
    source.search = relative.search;
    source.query = relative.query;
    source.host = relative.host || '';
    source.auth = relative.auth;
    source.hostname = relative.hostname || relative.host;
    source.port = relative.port;
    //to support http.request
    if (source.pathname !== undefined || source.search !== undefined) {
      source.path = (source.pathname ? source.pathname : '') +
                    (source.search ? source.search : '');
    }
    source.slashes = source.slashes || relative.slashes;
    source.href = urlFormat(source);
    return source;
  }

  var isSourceAbs = (source.pathname && source.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host !== undefined ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (source.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = source.pathname && source.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = source.protocol &&
          !slashedProtocol[source.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // source.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {

    delete source.hostname;
    delete source.port;
    if (source.host) {
      if (srcPath[0] === '') srcPath[0] = source.host;
      else srcPath.unshift(source.host);
    }
    delete source.host;
    if (relative.protocol) {
      delete relative.hostname;
      delete relative.port;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      delete relative.host;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    source.host = (relative.host || relative.host === '') ?
                      relative.host : source.host;
    source.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : source.hostname;
    source.search = relative.search;
    source.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    source.search = relative.search;
    source.query = relative.query;
  } else if ('search' in relative) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      source.hostname = source.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = source.host && source.host.indexOf('@') > 0 ?
                       source.host.split('@') : false;
      if (authInHost) {
        source.auth = authInHost.shift();
        source.host = source.hostname = authInHost.shift();
      }
    }
    source.search = relative.search;
    source.query = relative.query;
    //to support http.request
    if (source.pathname !== undefined || source.search !== undefined) {
      source.path = (source.pathname ? source.pathname : '') +
                    (source.search ? source.search : '');
    }
    source.href = urlFormat(source);
    return source;
  }
  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    delete source.pathname;
    //to support http.request
    if (!source.search) {
      source.path = '/' + source.search;
    } else {
      delete source.path;
    }
    source.href = urlFormat(source);
    return source;
  }
  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (source.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    source.hostname = source.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = source.host && source.host.indexOf('@') > 0 ?
                     source.host.split('@') : false;
    if (authInHost) {
      source.auth = authInHost.shift();
      source.host = source.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (source.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  source.pathname = srcPath.join('/');
  //to support request.http
  if (source.pathname !== undefined || source.search !== undefined) {
    source.path = (source.pathname ? source.pathname : '') +
                  (source.search ? source.search : '');
  }
  source.auth = relative.auth || source.auth;
  source.slashes = source.slashes || relative.slashes;
  source.href = urlFormat(source);
  return source;
}

function parseHost(host) {
  var out = {};
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      out.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) out.hostname = host;
  return out;
}

}());

},{"punycode":44,"querystring":47}],49:[function(require,module,exports){
/**
 * messageformat.js
 *
 * ICU PluralFormat + SelectFormat for JavaScript
 *
 * @author Alex Sexton - @SlexAxton
 * @version 0.1.7
 * @license WTFPL
 * @contributor_license Dojo CLA
*/
(function ( root ) {

  // Create the contructor function
  function MessageFormat ( locale, pluralFunc ) {
    var fallbackLocale;

    if ( locale && pluralFunc ) {
      MessageFormat.locale[ locale ] = pluralFunc;
    }

    // Defaults
    fallbackLocale = locale = locale || "en";
    pluralFunc = pluralFunc || MessageFormat.locale[ fallbackLocale = MessageFormat.Utils.getFallbackLocale( locale ) ];

    if ( ! pluralFunc ) {
      throw new Error( "Plural Function not found for locale: " + locale );
    }

    // Own Properties
    this.pluralFunc = pluralFunc;
    this.locale = locale;
    this.fallbackLocale = fallbackLocale;
  }

  // methods in common with the generated MessageFormat
  // check d
  c=function(d){
    if(!d){throw new Error("MessageFormat: No data passed to function.")}
  }
  // require number
  n=function(d,k,o){
    if(isNaN(d[k])){throw new Error("MessageFormat: `"+k+"` isnt a number.")}
    return d[k] - (o || 0);
  }
  // value
  v=function(d,k){
    c(d);
    return d[k];
  }
  // plural
  p=function(d,k,o,l,p){
    c(d);
    return d[k] in p ? p[d[k]] : (k = MessageFormat.locale[l](d[k]-o), k in p ? p[k] : p.other);
  }
  // select
  s=function(d,k,p){
    c(d);
    return d[k] in p ? p[d[k]] : p.other;
  }

  // Set up the locales object. Add in english by default
  MessageFormat.locale = {
    "en" : function ( n ) {
      if ( n === 1 ) {
        return "one";
      }
      return "other";
    }
  };

  // Build out our basic SafeString type
  // more or less stolen from Handlebars by @wycats
  MessageFormat.SafeString = function( string ) {
    this.string = string;
  };

  MessageFormat.SafeString.prototype.toString = function () {
    return this.string.toString();
  };

  MessageFormat.Utils = {
    numSub : function ( string, d, key, offset ) {
      // make sure that it's not an escaped octothorpe
      var s = string.replace( /(^|[^\\])#/g, '$1"+n(' + d + ',' + key + (offset ? ',' + offset : '') + ')+"' );
      return s.replace( /^""\+/, '' ).replace( /\+""$/, '' );
    },
    escapeExpression : function (string) {
      var escape = {
            "\n": "\\n",
            "\"": '\\"'
          },
          badChars = /[\n"]/g,
          possible = /[\n"]/,
          escapeChar = function(chr) {
            return escape[chr] || "&amp;";
          };

      // Don't escape SafeStrings, since they're already safe
      if ( string instanceof MessageFormat.SafeString ) {
        return string.toString();
      }
      else if ( string === null || string === false ) {
        return "";
      }

      if ( ! possible.test( string ) ) {
        return string;
      }
      return string.replace( badChars, escapeChar );
    },
    getFallbackLocale: function( locale ) {
      var tagSeparator = locale.indexOf("-") >= 0 ? "-" : "_";

      // Lets just be friends, fallback through the language tags
      while ( ! MessageFormat.locale.hasOwnProperty( locale ) ) {
        locale = locale.substring(0, locale.lastIndexOf( tagSeparator ));
        if (locale.length === 0) {
          return null;
        }
      }

      return locale;
    }
  };

  // This is generated and pulled in for browsers.
  var mparser = (function(){
    /*
     * Generated by PEG.js 0.7.0.
     *
     * http://pegjs.majda.cz/
     */
    
    function quote(s) {
      /*
       * ECMA-262, 5th ed., 7.8.4: All characters may appear literally in a
       * string literal except for the closing quote character, backslash,
       * carriage return, line separator, paragraph separator, and line feed.
       * Any character may appear in the form of an escape sequence.
       *
       * For portability, we also escape escape all control and non-ASCII
       * characters. Note that "\0" and "\v" escape sequences are not used
       * because JSHint does not like the first and IE the second.
       */
       return '"' + s
        .replace(/\\/g, '\\\\')  // backslash
        .replace(/"/g, '\\"')    // closing quote character
        .replace(/\x08/g, '\\b') // backspace
        .replace(/\t/g, '\\t')   // horizontal tab
        .replace(/\n/g, '\\n')   // line feed
        .replace(/\f/g, '\\f')   // form feed
        .replace(/\r/g, '\\r')   // carriage return
        .replace(/[\x00-\x07\x0B\x0E-\x1F\x80-\uFFFF]/g, escape)
        + '"';
    }
    
    var result = {
      /*
       * Parses the input with a generated parser. If the parsing is successfull,
       * returns a value explicitly or implicitly specified by the grammar from
       * which the parser was generated (see |PEG.buildParser|). If the parsing is
       * unsuccessful, throws |PEG.parser.SyntaxError| describing the error.
       */
      parse: function(input, startRule) {
        var parseFunctions = {
          "start": parse_start,
          "messageFormatPattern": parse_messageFormatPattern,
          "messageFormatPatternRight": parse_messageFormatPatternRight,
          "messageFormatElement": parse_messageFormatElement,
          "elementFormat": parse_elementFormat,
          "pluralStyle": parse_pluralStyle,
          "selectStyle": parse_selectStyle,
          "pluralFormatPattern": parse_pluralFormatPattern,
          "offsetPattern": parse_offsetPattern,
          "selectFormatPattern": parse_selectFormatPattern,
          "pluralForms": parse_pluralForms,
          "stringKey": parse_stringKey,
          "string": parse_string,
          "id": parse_id,
          "chars": parse_chars,
          "char": parse_char,
          "digits": parse_digits,
          "hexDigit": parse_hexDigit,
          "_": parse__,
          "whitespace": parse_whitespace
        };
        
        if (startRule !== undefined) {
          if (parseFunctions[startRule] === undefined) {
            throw new Error("Invalid rule name: " + quote(startRule) + ".");
          }
        } else {
          startRule = "start";
        }
        
        var pos = 0;
        var reportFailures = 0;
        var rightmostFailuresPos = 0;
        var rightmostFailuresExpected = [];
        
        function padLeft(input, padding, length) {
          var result = input;
          
          var padLength = length - input.length;
          for (var i = 0; i < padLength; i++) {
            result = padding + result;
          }
          
          return result;
        }
        
        function escape(ch) {
          var charCode = ch.charCodeAt(0);
          var escapeChar;
          var length;
          
          if (charCode <= 0xFF) {
            escapeChar = 'x';
            length = 2;
          } else {
            escapeChar = 'u';
            length = 4;
          }
          
          return '\\' + escapeChar + padLeft(charCode.toString(16).toUpperCase(), '0', length);
        }
        
        function matchFailed(failure) {
          if (pos < rightmostFailuresPos) {
            return;
          }
          
          if (pos > rightmostFailuresPos) {
            rightmostFailuresPos = pos;
            rightmostFailuresExpected = [];
          }
          
          rightmostFailuresExpected.push(failure);
        }
        
        function parse_start() {
          var result0;
          var pos0;
          
          pos0 = pos;
          result0 = parse_messageFormatPattern();
          if (result0 !== null) {
            result0 = (function(offset, messageFormatPattern) { return { type: "program", program: messageFormatPattern }; })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_messageFormatPattern() {
          var result0, result1, result2;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse_string();
          if (result0 !== null) {
            result1 = [];
            result2 = parse_messageFormatPatternRight();
            while (result2 !== null) {
              result1.push(result2);
              result2 = parse_messageFormatPatternRight();
            }
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, s1, inner) {
              var st = [];
              if ( s1 && s1.val ) {
                st.push( s1 );
              }
              for( var i in inner ){
                if ( inner.hasOwnProperty( i ) ) {
                  st.push( inner[ i ] );
                }
              }
              return { type: 'messageFormatPattern', statements: st };
            })(pos0, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_messageFormatPatternRight() {
          var result0, result1, result2, result3, result4, result5;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          if (input.charCodeAt(pos) === 123) {
            result0 = "{";
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("\"{\"");
            }
          }
          if (result0 !== null) {
            result1 = parse__();
            if (result1 !== null) {
              result2 = parse_messageFormatElement();
              if (result2 !== null) {
                result3 = parse__();
                if (result3 !== null) {
                  if (input.charCodeAt(pos) === 125) {
                    result4 = "}";
                    pos++;
                  } else {
                    result4 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"}\"");
                    }
                  }
                  if (result4 !== null) {
                    result5 = parse_string();
                    if (result5 !== null) {
                      result0 = [result0, result1, result2, result3, result4, result5];
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, mfe, s1) {
              var res = [];
              if ( mfe ) {
                res.push(mfe);
              }
              if ( s1 && s1.val ) {
                res.push( s1 );
              }
              return { type: "messageFormatPatternRight", statements : res };
            })(pos0, result0[2], result0[5]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_messageFormatElement() {
          var result0, result1, result2;
          var pos0, pos1, pos2;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse_id();
          if (result0 !== null) {
            pos2 = pos;
            if (input.charCodeAt(pos) === 44) {
              result1 = ",";
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\",\"");
              }
            }
            if (result1 !== null) {
              result2 = parse_elementFormat();
              if (result2 !== null) {
                result1 = [result1, result2];
              } else {
                result1 = null;
                pos = pos2;
              }
            } else {
              result1 = null;
              pos = pos2;
            }
            result1 = result1 !== null ? result1 : "";
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, argIdx, efmt) {
              var res = { 
                type: "messageFormatElement",
                argumentIndex: argIdx
              };
              if ( efmt && efmt.length ) {
                res.elementFormat = efmt[1];
              }
              else {
                res.output = true;
              }
              return res;
            })(pos0, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_elementFormat() {
          var result0, result1, result2, result3, result4, result5, result6;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse__();
          if (result0 !== null) {
            if (input.substr(pos, 6) === "plural") {
              result1 = "plural";
              pos += 6;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"plural\"");
              }
            }
            if (result1 !== null) {
              result2 = parse__();
              if (result2 !== null) {
                if (input.charCodeAt(pos) === 44) {
                  result3 = ",";
                  pos++;
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\",\"");
                  }
                }
                if (result3 !== null) {
                  result4 = parse__();
                  if (result4 !== null) {
                    result5 = parse_pluralStyle();
                    if (result5 !== null) {
                      result6 = parse__();
                      if (result6 !== null) {
                        result0 = [result0, result1, result2, result3, result4, result5, result6];
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, t, s) {
              return {
                type : "elementFormat",
                key  : t,
                val  : s.val
              };
            })(pos0, result0[1], result0[5]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            pos1 = pos;
            result0 = parse__();
            if (result0 !== null) {
              if (input.substr(pos, 6) === "select") {
                result1 = "select";
                pos += 6;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("\"select\"");
                }
              }
              if (result1 !== null) {
                result2 = parse__();
                if (result2 !== null) {
                  if (input.charCodeAt(pos) === 44) {
                    result3 = ",";
                    pos++;
                  } else {
                    result3 = null;
                    if (reportFailures === 0) {
                      matchFailed("\",\"");
                    }
                  }
                  if (result3 !== null) {
                    result4 = parse__();
                    if (result4 !== null) {
                      result5 = parse_selectStyle();
                      if (result5 !== null) {
                        result6 = parse__();
                        if (result6 !== null) {
                          result0 = [result0, result1, result2, result3, result4, result5, result6];
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
            if (result0 !== null) {
              result0 = (function(offset, t, s) {
                return {
                  type : "elementFormat",
                  key  : t,
                  val  : s.val
                };
              })(pos0, result0[1], result0[5]);
            }
            if (result0 === null) {
              pos = pos0;
            }
          }
          return result0;
        }
        
        function parse_pluralStyle() {
          var result0;
          var pos0;
          
          pos0 = pos;
          result0 = parse_pluralFormatPattern();
          if (result0 !== null) {
            result0 = (function(offset, pfp) {
              return { type: "pluralStyle", val: pfp };
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_selectStyle() {
          var result0;
          var pos0;
          
          pos0 = pos;
          result0 = parse_selectFormatPattern();
          if (result0 !== null) {
            result0 = (function(offset, sfp) {
              return { type: "selectStyle", val: sfp };
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_pluralFormatPattern() {
          var result0, result1, result2;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse_offsetPattern();
          result0 = result0 !== null ? result0 : "";
          if (result0 !== null) {
            result1 = [];
            result2 = parse_pluralForms();
            while (result2 !== null) {
              result1.push(result2);
              result2 = parse_pluralForms();
            }
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, op, pf) {
              var res = {
                type: "pluralFormatPattern",
                pluralForms: pf
              };
              if ( op ) {
                res.offset = op;
              }
              else {
                res.offset = 0;
              }
              return res;
            })(pos0, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_offsetPattern() {
          var result0, result1, result2, result3, result4, result5, result6;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse__();
          if (result0 !== null) {
            if (input.substr(pos, 6) === "offset") {
              result1 = "offset";
              pos += 6;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("\"offset\"");
              }
            }
            if (result1 !== null) {
              result2 = parse__();
              if (result2 !== null) {
                if (input.charCodeAt(pos) === 58) {
                  result3 = ":";
                  pos++;
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\":\"");
                  }
                }
                if (result3 !== null) {
                  result4 = parse__();
                  if (result4 !== null) {
                    result5 = parse_digits();
                    if (result5 !== null) {
                      result6 = parse__();
                      if (result6 !== null) {
                        result0 = [result0, result1, result2, result3, result4, result5, result6];
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, d) {
              return d;
            })(pos0, result0[5]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_selectFormatPattern() {
          var result0, result1;
          var pos0;
          
          pos0 = pos;
          result0 = [];
          result1 = parse_pluralForms();
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_pluralForms();
          }
          if (result0 !== null) {
            result0 = (function(offset, pf) {
              return {
                type: "selectFormatPattern",
                pluralForms: pf
              };
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_pluralForms() {
          var result0, result1, result2, result3, result4, result5, result6, result7;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse__();
          if (result0 !== null) {
            result1 = parse_stringKey();
            if (result1 !== null) {
              result2 = parse__();
              if (result2 !== null) {
                if (input.charCodeAt(pos) === 123) {
                  result3 = "{";
                  pos++;
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"{\"");
                  }
                }
                if (result3 !== null) {
                  result4 = parse__();
                  if (result4 !== null) {
                    result5 = parse_messageFormatPattern();
                    if (result5 !== null) {
                      result6 = parse__();
                      if (result6 !== null) {
                        if (input.charCodeAt(pos) === 125) {
                          result7 = "}";
                          pos++;
                        } else {
                          result7 = null;
                          if (reportFailures === 0) {
                            matchFailed("\"}\"");
                          }
                        }
                        if (result7 !== null) {
                          result0 = [result0, result1, result2, result3, result4, result5, result6, result7];
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, k, mfp) {
              return {
                type: "pluralForms",
                key: k,
                val: mfp
              };
            })(pos0, result0[1], result0[5]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_stringKey() {
          var result0, result1;
          var pos0, pos1;
          
          pos0 = pos;
          result0 = parse_id();
          if (result0 !== null) {
            result0 = (function(offset, i) {
              return i;
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            pos1 = pos;
            if (input.charCodeAt(pos) === 61) {
              result0 = "=";
              pos++;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"=\"");
              }
            }
            if (result0 !== null) {
              result1 = parse_digits();
              if (result1 !== null) {
                result0 = [result0, result1];
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
            if (result0 !== null) {
              result0 = (function(offset, d) {
                return d;
              })(pos0, result0[1]);
            }
            if (result0 === null) {
              pos = pos0;
            }
          }
          return result0;
        }
        
        function parse_string() {
          var result0, result1, result2, result3, result4;
          var pos0, pos1, pos2;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse__();
          if (result0 !== null) {
            result1 = [];
            pos2 = pos;
            result2 = parse__();
            if (result2 !== null) {
              result3 = parse_chars();
              if (result3 !== null) {
                result4 = parse__();
                if (result4 !== null) {
                  result2 = [result2, result3, result4];
                } else {
                  result2 = null;
                  pos = pos2;
                }
              } else {
                result2 = null;
                pos = pos2;
              }
            } else {
              result2 = null;
              pos = pos2;
            }
            while (result2 !== null) {
              result1.push(result2);
              pos2 = pos;
              result2 = parse__();
              if (result2 !== null) {
                result3 = parse_chars();
                if (result3 !== null) {
                  result4 = parse__();
                  if (result4 !== null) {
                    result2 = [result2, result3, result4];
                  } else {
                    result2 = null;
                    pos = pos2;
                  }
                } else {
                  result2 = null;
                  pos = pos2;
                }
              } else {
                result2 = null;
                pos = pos2;
              }
            }
            if (result1 !== null) {
              result0 = [result0, result1];
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, ws, s) {
              var tmp = [];
              for( var i = 0; i < s.length; ++i ) {
                for( var j = 0; j < s[ i ].length; ++j ) {
                  tmp.push(s[i][j]);
                }
              }
              return {
                type: "string",
                val: ws + tmp.join('')
              };
            })(pos0, result0[0], result0[1]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_id() {
          var result0, result1, result2, result3;
          var pos0, pos1;
          
          pos0 = pos;
          pos1 = pos;
          result0 = parse__();
          if (result0 !== null) {
            if (/^[0-9a-zA-Z$_]/.test(input.charAt(pos))) {
              result1 = input.charAt(pos);
              pos++;
            } else {
              result1 = null;
              if (reportFailures === 0) {
                matchFailed("[0-9a-zA-Z$_]");
              }
            }
            if (result1 !== null) {
              result2 = [];
              if (/^[^ \t\n\r,.+={}]/.test(input.charAt(pos))) {
                result3 = input.charAt(pos);
                pos++;
              } else {
                result3 = null;
                if (reportFailures === 0) {
                  matchFailed("[^ \\t\\n\\r,.+={}]");
                }
              }
              while (result3 !== null) {
                result2.push(result3);
                if (/^[^ \t\n\r,.+={}]/.test(input.charAt(pos))) {
                  result3 = input.charAt(pos);
                  pos++;
                } else {
                  result3 = null;
                  if (reportFailures === 0) {
                    matchFailed("[^ \\t\\n\\r,.+={}]");
                  }
                }
              }
              if (result2 !== null) {
                result3 = parse__();
                if (result3 !== null) {
                  result0 = [result0, result1, result2, result3];
                } else {
                  result0 = null;
                  pos = pos1;
                }
              } else {
                result0 = null;
                pos = pos1;
              }
            } else {
              result0 = null;
              pos = pos1;
            }
          } else {
            result0 = null;
            pos = pos1;
          }
          if (result0 !== null) {
            result0 = (function(offset, s1, s2) {
              return s1 + (s2 ? s2.join('') : '');
            })(pos0, result0[1], result0[2]);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_chars() {
          var result0, result1;
          var pos0;
          
          pos0 = pos;
          result1 = parse_char();
          if (result1 !== null) {
            result0 = [];
            while (result1 !== null) {
              result0.push(result1);
              result1 = parse_char();
            }
          } else {
            result0 = null;
          }
          if (result0 !== null) {
            result0 = (function(offset, chars) { return chars.join(''); })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_char() {
          var result0, result1, result2, result3, result4;
          var pos0, pos1;
          
          pos0 = pos;
          if (/^[^{}\\\0-\x1F \t\n\r]/.test(input.charAt(pos))) {
            result0 = input.charAt(pos);
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("[^{}\\\\\\0-\\x1F \\t\\n\\r]");
            }
          }
          if (result0 !== null) {
            result0 = (function(offset, x) {
              return x;
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          if (result0 === null) {
            pos0 = pos;
            if (input.substr(pos, 2) === "\\#") {
              result0 = "\\#";
              pos += 2;
            } else {
              result0 = null;
              if (reportFailures === 0) {
                matchFailed("\"\\\\#\"");
              }
            }
            if (result0 !== null) {
              result0 = (function(offset) {
                return "\\#";
              })(pos0);
            }
            if (result0 === null) {
              pos = pos0;
            }
            if (result0 === null) {
              pos0 = pos;
              if (input.substr(pos, 2) === "\\{") {
                result0 = "\\{";
                pos += 2;
              } else {
                result0 = null;
                if (reportFailures === 0) {
                  matchFailed("\"\\\\{\"");
                }
              }
              if (result0 !== null) {
                result0 = (function(offset) {
                  return "\u007B";
                })(pos0);
              }
              if (result0 === null) {
                pos = pos0;
              }
              if (result0 === null) {
                pos0 = pos;
                if (input.substr(pos, 2) === "\\}") {
                  result0 = "\\}";
                  pos += 2;
                } else {
                  result0 = null;
                  if (reportFailures === 0) {
                    matchFailed("\"\\\\}\"");
                  }
                }
                if (result0 !== null) {
                  result0 = (function(offset) {
                    return "\u007D";
                  })(pos0);
                }
                if (result0 === null) {
                  pos = pos0;
                }
                if (result0 === null) {
                  pos0 = pos;
                  pos1 = pos;
                  if (input.substr(pos, 2) === "\\u") {
                    result0 = "\\u";
                    pos += 2;
                  } else {
                    result0 = null;
                    if (reportFailures === 0) {
                      matchFailed("\"\\\\u\"");
                    }
                  }
                  if (result0 !== null) {
                    result1 = parse_hexDigit();
                    if (result1 !== null) {
                      result2 = parse_hexDigit();
                      if (result2 !== null) {
                        result3 = parse_hexDigit();
                        if (result3 !== null) {
                          result4 = parse_hexDigit();
                          if (result4 !== null) {
                            result0 = [result0, result1, result2, result3, result4];
                          } else {
                            result0 = null;
                            pos = pos1;
                          }
                        } else {
                          result0 = null;
                          pos = pos1;
                        }
                      } else {
                        result0 = null;
                        pos = pos1;
                      }
                    } else {
                      result0 = null;
                      pos = pos1;
                    }
                  } else {
                    result0 = null;
                    pos = pos1;
                  }
                  if (result0 !== null) {
                    result0 = (function(offset, h1, h2, h3, h4) {
                        return String.fromCharCode(parseInt("0x" + h1 + h2 + h3 + h4));
                    })(pos0, result0[1], result0[2], result0[3], result0[4]);
                  }
                  if (result0 === null) {
                    pos = pos0;
                  }
                }
              }
            }
          }
          return result0;
        }
        
        function parse_digits() {
          var result0, result1;
          var pos0;
          
          pos0 = pos;
          if (/^[0-9]/.test(input.charAt(pos))) {
            result1 = input.charAt(pos);
            pos++;
          } else {
            result1 = null;
            if (reportFailures === 0) {
              matchFailed("[0-9]");
            }
          }
          if (result1 !== null) {
            result0 = [];
            while (result1 !== null) {
              result0.push(result1);
              if (/^[0-9]/.test(input.charAt(pos))) {
                result1 = input.charAt(pos);
                pos++;
              } else {
                result1 = null;
                if (reportFailures === 0) {
                  matchFailed("[0-9]");
                }
              }
            }
          } else {
            result0 = null;
          }
          if (result0 !== null) {
            result0 = (function(offset, ds) {
              return parseInt((ds.join('')), 10);
            })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          return result0;
        }
        
        function parse_hexDigit() {
          var result0;
          
          if (/^[0-9a-fA-F]/.test(input.charAt(pos))) {
            result0 = input.charAt(pos);
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("[0-9a-fA-F]");
            }
          }
          return result0;
        }
        
        function parse__() {
          var result0, result1;
          var pos0;
          
          reportFailures++;
          pos0 = pos;
          result0 = [];
          result1 = parse_whitespace();
          while (result1 !== null) {
            result0.push(result1);
            result1 = parse_whitespace();
          }
          if (result0 !== null) {
            result0 = (function(offset, w) { return w.join(''); })(pos0, result0);
          }
          if (result0 === null) {
            pos = pos0;
          }
          reportFailures--;
          if (reportFailures === 0 && result0 === null) {
            matchFailed("whitespace");
          }
          return result0;
        }
        
        function parse_whitespace() {
          var result0;
          
          if (/^[ \t\n\r]/.test(input.charAt(pos))) {
            result0 = input.charAt(pos);
            pos++;
          } else {
            result0 = null;
            if (reportFailures === 0) {
              matchFailed("[ \\t\\n\\r]");
            }
          }
          return result0;
        }
        
        
        function cleanupExpected(expected) {
          expected.sort();
          
          var lastExpected = null;
          var cleanExpected = [];
          for (var i = 0; i < expected.length; i++) {
            if (expected[i] !== lastExpected) {
              cleanExpected.push(expected[i]);
              lastExpected = expected[i];
            }
          }
          return cleanExpected;
        }
        
        function computeErrorPosition() {
          /*
           * The first idea was to use |String.split| to break the input up to the
           * error position along newlines and derive the line and column from
           * there. However IE's |split| implementation is so broken that it was
           * enough to prevent it.
           */
          
          var line = 1;
          var column = 1;
          var seenCR = false;
          
          for (var i = 0; i < Math.max(pos, rightmostFailuresPos); i++) {
            var ch = input.charAt(i);
            if (ch === "\n") {
              if (!seenCR) { line++; }
              column = 1;
              seenCR = false;
            } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
              line++;
              column = 1;
              seenCR = true;
            } else {
              column++;
              seenCR = false;
            }
          }
          
          return { line: line, column: column };
        }
        
        
        var result = parseFunctions[startRule]();
        
        /*
         * The parser is now in one of the following three states:
         *
         * 1. The parser successfully parsed the whole input.
         *
         *    - |result !== null|
         *    - |pos === input.length|
         *    - |rightmostFailuresExpected| may or may not contain something
         *
         * 2. The parser successfully parsed only a part of the input.
         *
         *    - |result !== null|
         *    - |pos < input.length|
         *    - |rightmostFailuresExpected| may or may not contain something
         *
         * 3. The parser did not successfully parse any part of the input.
         *
         *   - |result === null|
         *   - |pos === 0|
         *   - |rightmostFailuresExpected| contains at least one failure
         *
         * All code following this comment (including called functions) must
         * handle these states.
         */
        if (result === null || pos !== input.length) {
          var offset = Math.max(pos, rightmostFailuresPos);
          var found = offset < input.length ? input.charAt(offset) : null;
          var errorPosition = computeErrorPosition();
          
          throw new this.SyntaxError(
            cleanupExpected(rightmostFailuresExpected),
            found,
            offset,
            errorPosition.line,
            errorPosition.column
          );
        }
        
        return result;
      },
      
      /* Returns the parser source code. */
      toSource: function() { return this._source; }
    };
    
    /* Thrown when a parser encounters a syntax error. */
    
    result.SyntaxError = function(expected, found, offset, line, column) {
      function buildMessage(expected, found) {
        var expectedHumanized, foundHumanized;
        
        switch (expected.length) {
          case 0:
            expectedHumanized = "end of input";
            break;
          case 1:
            expectedHumanized = expected[0];
            break;
          default:
            expectedHumanized = expected.slice(0, expected.length - 1).join(", ")
              + " or "
              + expected[expected.length - 1];
        }
        
        foundHumanized = found ? quote(found) : "end of input";
        
        return "Expected " + expectedHumanized + " but " + foundHumanized + " found.";
      }
      
      this.name = "SyntaxError";
      this.expected = expected;
      this.found = found;
      this.message = buildMessage(expected, found);
      this.offset = offset;
      this.line = line;
      this.column = column;
    };
    
    result.SyntaxError.prototype = Error.prototype;
    
    return result;
  })();

  MessageFormat.prototype.parse = function () {
    // Bind to itself so error handling works
    return mparser.parse.apply( mparser, arguments );
  };

  MessageFormat.prototype.precompile = function ( ast ) {
    var self = this,
        needOther = false;

    function _next ( data ) {
      var res = JSON.parse( JSON.stringify( data ) );
      res.pf_count++;
      return res;
    }
    function interpMFP ( ast, data ) {
      // Set some default data
      data = data || { keys: {}, offset: {} };
      var r = [], i, tmp;

      switch ( ast.type ) {
        case 'program':
          return interpMFP( ast.program );
        case 'messageFormatPattern':
          for ( i = 0; i < ast.statements.length; ++i ) {
            r.push(interpMFP( ast.statements[i], data ));
          }
          tmp = r.join('+') || '""';
          return data.pf_count ? tmp : 'function(d){return ' + tmp + '}';
        case 'messageFormatPatternRight':
          for ( i = 0; i < ast.statements.length; ++i ) {
            r.push(interpMFP( ast.statements[i], data ));
          }
          return r.join('+');
        case 'messageFormatElement':
          data.pf_count = data.pf_count || 0;
          if ( ast.output ) {
            return 'v(d,"' + ast.argumentIndex + '")';
          }
          else {
            data.keys[data.pf_count] = '"' + ast.argumentIndex + '"';
            return interpMFP( ast.elementFormat, data );
          }
          return '';
        case 'elementFormat':
          if ( ast.key === 'select' ) {
            return 's(d,' + data.keys[data.pf_count] + ',' + interpMFP( ast.val, data ) + ')';
          }
          else if ( ast.key === 'plural' ) {
            data.offset[data.pf_count || 0] = ast.val.offset || 0;
            return 'p(d,' + data.keys[data.pf_count] + ',' + (data.offset[data.pf_count] || 0)
              + ',"' + self.fallbackLocale + '",' + interpMFP( ast.val, data ) + ')';
          }
          return '';
        /* // Unreachable cases.
        case 'pluralStyle':
        case 'selectStyle':*/
        case 'pluralFormatPattern':
          data.pf_count = data.pf_count || 0;
          needOther = true;
          // We're going to simultaneously check to make sure we hit the required 'other' option.

          for ( i = 0; i < ast.pluralForms.length; ++i ) {
            if ( ast.pluralForms[ i ].key === 'other' ) {
              needOther = false;
            }
            r.push('"' + ast.pluralForms[ i ].key + '":' + interpMFP( ast.pluralForms[ i ].val, _next(data) ));
          }
          if ( needOther ) {
            throw new Error("No 'other' form found in pluralFormatPattern " + data.pf_count);
          }
          return '{' + r.join(',') + '}';
        case 'selectFormatPattern':

          data.pf_count = data.pf_count || 0;
          data.offset[data.pf_count] = 0;
          needOther = true;

          for ( i = 0; i < ast.pluralForms.length; ++i ) {
            if ( ast.pluralForms[ i ].key === 'other' ) {
              needOther = false;
            }
            r.push('"' + ast.pluralForms[ i ].key + '":' + interpMFP( ast.pluralForms[ i ].val, _next(data) ));
          }
          if ( needOther ) {
            throw new Error("No 'other' form found in selectFormatPattern " + data.pf_count);
          }
          return '{' + r.join(',') + '}';
        /* // Unreachable
        case 'pluralForms':
        */
        case 'string':
          tmp = '"' + MessageFormat.Utils.escapeExpression( ast.val ) + '"';
          if ( data.pf_count ) {
            tmp = MessageFormat.Utils.numSub( tmp, 'd', data.keys[data.pf_count-1], data.offset[data.pf_count-1]);
          }
          return tmp;
        default:
          throw new Error( 'Bad AST type: ' + ast.type );
      }
    }
    return interpMFP( ast );
  };

  MessageFormat.prototype.compile = function ( message ) {
    return (new Function( 'MessageFormat',
      'return ' +
        this.precompile(
          this.parse( message )
        )
    ))(MessageFormat);
  };


  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = MessageFormat;
    }
    exports.MessageFormat = MessageFormat;
  }
  else if (typeof define === 'function' && define.amd) {
    define(function() {
      return MessageFormat;
    });
  }
  else {
    root['MessageFormat'] = MessageFormat;
  }

})( this );

},{}]},{},[18])