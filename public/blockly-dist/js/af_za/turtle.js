(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
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
  blocksCommon.install(Blockly, options.skin);
  options.blocksModule.install(Blockly, options.skin);

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
},{"./base":2,"./blocksCommon":4,"./dom":7}],2:[function(require,module,exports){
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
var msg = require('../locale/af_za/common');
var parseXmlElement = require('./xml').parseElement;
var feedback = require('./feedback.js');
var dom = require('./dom');
var utils = require('./utils');
var builder = require('./builder');
var Slider = require('./slider');

//TODO: These should be members of a BlocklyApp instance.
var onAttempt;
var onContinue;
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
  backToPreviousLevel = config.backToPreviousLevel || function() {};

  var container = document.getElementById(config.containerId);
  container.innerHTML = config.html;
  var runButton = container.querySelector('#runButton');
  var resetButton = container.querySelector('#resetButton');
  dom.addClickTouchEvent(runButton, BlocklyApps.runButtonClick);
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
  if (showCode) {
    if (BlocklyApps.enableShowCode) {
      dom.addClickTouchEvent(showCode, function() {
        feedback.showGeneratedCode(BlocklyApps.Dialog);
      });
    }
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

  var div = document.getElementById('blockly');
  var options = {
    toolbox: config.level.toolbox
  };
  ['trashcan', 'scrollbars', 'concreteBlocks'].forEach(function (prop) {
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

/**
 * If the user has executed too many actions, we're probably in an infinite
 * loop.  Sadly I wasn't able to solve the Halting Problem.
 * @param {?string} opt_id ID of loop block to highlight.
 * @throws {Infinity} Throws an error to terminate the user's program.
 */
BlocklyApps.checkTimeout = function(opt_id) {
  if (opt_id) {
    BlocklyApps.log.push([null, opt_id]);
  }
  if (BlocklyApps.ticks-- < 0) {
    throw Infinity;
  }
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
 * Transcript of user's actions.  The format is application-dependent.
 * @type {?Array.<Array>}
 */
BlocklyApps.log = null;

/**
 * The number of steps remaining before the currently running program
 * is deemed to be in an infinite loop and terminated.
 * @type {?number}
 */
BlocklyApps.ticks = null;

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
 * animation tasks.  This will benerally be replaced by an application.
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
  NO_TESTS_RUN: -1,           // Default.
  EMPTY_BLOCK_FAIL: 1,        // 0 stars.
  TOO_FEW_BLOCKS_FAIL: 2,     // 0 stars.
  LEVEL_INCOMPLETE_FAIL: 3,   // 0 stars.
  MISSING_BLOCK_UNFINISHED: 4,// 0 star.
  EXTRA_TOP_BLOCKS_FAIL: 5,   // 0 stars.
  MISSING_BLOCK_FINISHED: 10, // 1 star.
  OTHER_1_STAR_FAIL: 11,      // Application-specific 1-star failure.
  TOO_MANY_BLOCKS_FAIL: 20,   // 2 stars, try again or continue.
  OTHER_2_STAR_FAIL: 21,      // Application-specific 2-star failure.
  FLAPPY_SPECIFIC_FAIL: 22,   // Flappy failure
  FREE_PLAY: 30,              // 2 stars.
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
    document.getElementById('runButton').setAttribute('disabled', 'disabled');

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
  document.getElementById('runButton').style.display = 'inline';
  document.getElementById('resetButton').style.display = 'none';
  BlocklyApps.clearHighlighting();
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

},{"../locale/af_za/common":36,"./builder":5,"./dom":7,"./feedback.js":8,"./slider":11,"./templates/buttons.html":13,"./templates/instructions.html":15,"./templates/learn.html":16,"./templates/makeYourOwn.html":17,"./utils":34,"./xml":35}],3:[function(require,module,exports){
exports.createToolbox = function(blocks) {
  return '<xml id="toolbox" style="display: none;">' + blocks + '</xml>';
};

exports.blockOfType = function(type) {
  return '<block type="' + type + '"></block>';
};

exports.createCategory = function(name, blocks, custom) {
  return '<category name="' + name + '"' +
          (custom ? ' custom="' + custom + '"' : '') +
          '>' + blocks + '</category>';
};

},{}],4:[function(require,module,exports){
/**
 * Defines blocks useful in multiple blockly apps
 */
'use strict';

/**
 * Install extensions to Blockly's language and JavaScript generator
 * @param blockly instance of Blockly
 */
exports.install = function(blockly, skin) {
  // Re-uses the repeat block generator from core
  blockly.JavaScript.controls_repeat_simplified = blockly.JavaScript.controls_repeat;

  blockly.Blocks.controls_repeat_simplified = {
    // Repeat n times (internal number) with simplified UI
    init: function() {
      this.setHelpUrl(blockly.Msg.CONTROLS_REPEAT_HELPURL);
      this.setHSV(322, 0.90, 0.95);
      this.appendStatementInput('DO')
        .appendTitle(new blockly.FieldImage(skin.repeatImage));
      this.appendDummyInput()
        .appendTitle(blockly.Msg.CONTROLS_REPEAT_TITLE_REPEAT)
        .appendTitle(new Blockly.FieldTextInput('10',
          blockly.FieldTextInput.nonnegativeIntegerValidator), 'TIMES');
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

},{"./dom.js":7,"./feedback.js":8,"./templates/builder.html":12,"./utils.js":34,"url":48}],6:[function(require,module,exports){
var INFINITE_LOOP_TRAP = '  BlocklyApps.checkTimeout();\n';
var INFINITE_LOOP_TRAP_RE =
    new RegExp(INFINITE_LOOP_TRAP.replace(/\(.*\)/, '\\(.*\\)'), 'g');

/**
 * Returns javascript code to call a timeout check with an optional block id.
 */
exports.loopTrap = function(blockId) {
  var args = (blockId ? "'block_id_" + blockId + "'" : '');
 return INFINITE_LOOP_TRAP.replace('()', '(' + args + ')');
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
    .replace(INFINITE_LOOP_TRAP_RE, '')
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
var msg = require('../locale/af_za/common');
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
      var blocks = BlocklyApps.REQUIRED_BLOCKS[i];
      // For each of the test
      // If at least one of the tests succeeded, we consider the required block
      // is used
      var usedRequiredBlock = false;
      for (var testId = 0; testId < blocks.length; testId++) {
        var test = blocks[testId].test;
        if (typeof test === 'string') {
          if (!code) {
            code = Blockly.Generator.workspaceToCode('JavaScript');
          }
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


},{"../locale/af_za/common":36,"./codegen":6,"./dom":7,"./templates/buttons.html":13,"./templates/code.html":14,"./templates/readonly.html":19,"./templates/sharing.html":20,"./templates/showCode.html":21,"./templates/trophy.html":22,"./utils":34}],9:[function(require,module,exports){
// Functions for checking required blocks.

/**
 * Generate a required blocks dictionary for a call to a procedure that does
 * not have a return value.
 * @param {string} name The name of the procedure being called.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.call = function(name) {
  return {
    test: function(block) {
      return block.type == 'procedures_callnoreturn' &&
          block.getTitleValue('NAME') == name;
    },
    type: 'procedures_callnoreturn',
    titles: {'NAME': name}
  };
};

/**
 * Generate a required blocks dictionary for a call to a procedure with a
 * single argument.
 * @param {string} func_name The name of the procedure being called.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.callWithArg = function(func_name, arg_name) {
  return {
    test: function(block) {
      return block.type == 'procedures_callnoreturn' &&
          block.getTitleValue('NAME') == func_name;
    },
    type: 'procedures_callnoreturn',
    extra: '<mutation name="' + func_name + '"><arg name="' + arg_name +
        '"></arg></mutation>'
  };
};

/**
 * Generate a required blocks dictionary for the definition of a procedure
 * that does not have a return value.  This does not check if any arguments
 * are defined for the procedure.
 * @param {string} name The name of the procedure being defined.
 * @return {Object} A required blocks dictionary able to check for and
 *     generate the specified block.
 */
exports.define = function(name) {
  return {
    test: function(block) {
      return block.type == 'procedures_defnoreturn' &&
          block.getTitleValue('NAME') == name;
    },
    type: 'procedures_defnoreturn',
    titles: {'NAME': name}
  };
};

},{}],10:[function(require,module,exports){
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
    leftJumpArrow: assetUrl('media/common_images/jump-west-arrow.png'),
    downJumpArrow: assetUrl('media/common_images/jump-south-arrow.png'),
    upJumpArrow: assetUrl('media/common_images/jump-north-arrow.png'),
    rightJumpArrow: assetUrl('media/common_images/jump-east-arrow.png'),
    shortLineDraw: assetUrl('media/common_images/draw-short-line-crayon.png'),
    longLineDraw: assetUrl('media/common_images/draw-long-line-crayon.png'),
    // Sounds
    startSound: [skinUrl('start.mp3'), skinUrl('start.ogg')],
    winSound: [skinUrl('win.mp3'), skinUrl('win.ogg')],
    failureSound: [skinUrl('failure.mp3'), skinUrl('failure.ogg')]
  };
  return skin;
};

},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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
},{"ejs":38}],13:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common'); ; buf.push('\n\n');3; if (data.ok) {; buf.push('  <div class="farSide" style="padding: 1ex 3ex 0">\n    <button id="ok-button" class="secondary">\n      ', escape((5,  msg.dialogOK() )), '\n    </button>\n  </div>\n');8; }; buf.push('\n');9; if (data.previousLevel) {; buf.push('  <button id="back-button" class="launch">\n    ', escape((10,  msg.backToPreviousLevel() )), '\n  </button>\n');12; }; buf.push('\n');13; if (data.tryAgain) {; buf.push('  <button id="again-button" class="launch">\n    ', escape((14,  msg.tryAgain() )), '\n  </button>\n');16; }; buf.push('\n');17; if (data.nextLevel) {; buf.push('  <button id="continue-button" class="launch">\n    ', escape((18,  msg.continue() )), '\n  </button>\n');20; }; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],14:[function(require,module,exports){
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
},{"ejs":38}],15:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common'); ; buf.push('\n\n<p class=\'dialog-title\'>', escape((3,  msg.puzzleTitle(locals) )), '</p>\n');4; if (locals.instructionImageUrl) {; buf.push('  <img class=\'instruction-image\' src=\'', escape((4,  locals.instructionImageUrl )), '\'>\n  <p class=\'instruction-with-image\'>', escape((5,  instructions )), '</p>\n');6; } else {; buf.push('  <p>', escape((6,  instructions )), '</p>\n');7; };; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],16:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common') ; buf.push('\n\n');3; var root = location.protocol + '//' + location.host.replace('learn\.', ''); 
; buf.push('\n\n<div id="learn">\n\n  <h1><a href="', escape((7,  root )), '">', escape((7,  msg.wantToLearn() )), '</a></h1>\n  <a href="', escape((8,  root )), '"><img id="learn-to-code" src="', escape((8,  BlocklyApps.assetUrl('media/promo.png') )), '"></a>\n  <a href="', escape((9,  root )), '">', escape((9,  msg.watchVideo() )), '</a>\n  <a href="', escape((10,  root )), '">', escape((10,  msg.tryHOC() )), '</a>\n  <a href="', escape((11,  location.protocol + '//' + location.host 
)), '">', escape((11,  msg.signup() )), '</a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],17:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common') ; buf.push('\n\n<div id="make-your-own">\n\n  <h1><a href=', escape((5,  data.makeUrl )), '>', escape((5,  data.makeString )), '</a></h1>\n  <a href=', escape((6,  data.makeUrl )), '><img src=', escape((6,  data.makeImage )), '></a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],18:[function(require,module,exports){
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
  var msg = require('../../locale/af_za/common');
  var hideRunButton = locals.hideRunButton || false;
; buf.push('\n\n<div id="rotateContainer" style="background-image: url(', escape((6,  assetUrl('media/mobile_tutorial_turnphone.png') )), ')">\n  <div id="rotateText">\n    <p>', escape((8,  msg.rotateText() )), '<br>', escape((8,  msg.orientationLock() )), '</p>\n  </div>\n</div>\n\n');12; var instructions = function() {; buf.push('  <div id="bubble">\n    <img id="prompt-icon">\n    <p id="prompt">\n    </p>\n  </div>\n');17; };; buf.push('\n');18; // A spot for the server to inject some HTML for help content.
var helpArea = function(html) {; buf.push('  ');19; if (html) {; buf.push('    <div id="helpArea">\n      ', (20,  html ), '\n    </div>\n  ');22; }; buf.push('');22; };; buf.push('\n');23; var codeArea = function() {; buf.push('  <div id="codeTextbox" contenteditable spellcheck=false>\n    // ', escape((24,  msg.typeCode() )), '\n    <br>\n    // ', escape((26,  msg.typeHint() )), '\n    <br>\n  </div>\n');29; }; ; buf.push('\n\n<div id="visualization">\n  ', (32,  data.visualization ), '\n</div>\n\n<div id="belowVisualization">\n\n  <table id="gameButtons">\n    <tr>\n      <td style="width:100%;">\n        <button id="runButton" class="launch ', escape((40,  hideRunButton ? 'hide' : '')), '">\n          <img src="', escape((41,  assetUrl('media/1x1.gif') )), '" class="run icon21">\n          ', escape((42,  msg.runProgram() )), '\n        </button>\n        <button id="resetButton" class="launch" style="display: none">\n          <img src="', escape((45,  assetUrl('media/1x1.gif') )), '" class="stop icon21">\n            ', escape((46,  msg.resetProgram() )), '\n        </button>\n      </td>\n      ');49; if (data.controls) { ; buf.push('\n        ', (50,  data.controls ), '\n      ');51; } ; buf.push('\n    </tr>\n    ');53; if (data.extraControlRows) { ; buf.push('\n      ', (54,  data.extraControlRows ), '\n    ');55; } ; buf.push('\n  </table>\n\n  ');58; instructions() ; buf.push('\n  ');59; helpArea(data.helpHtml) ; buf.push('\n\n</div>\n\n<div id="blockly">\n  <div id="headers" dir="', escape((64,  data.localeDirection )), '">\n    <div id="toolbox-header" class="blockly-header"><span>', escape((65,  msg.toolboxHeader() )), '</span></div>\n    <div id="workspace-header" class="blockly-header">\n      <span id="blockCounter">', escape((67,  msg.workspaceHeader() )), '</span>\n      <div id="blockUsed" class=', escape((68,  data.blockCounterClass )), '>\n        ', escape((69,  data.blockUsed )), '\n      </div>\n      <span>&nbsp;/</span>\n      <span id="idealBlockNumber">', escape((72,  data.idealBlockNumber )), '</span>\n    </div>\n    <div id="show-code-header" class="blockly-header"><span>', escape((74,  msg.showCodeHeader() )), '</span></div>\n  </div>\n</div>\n\n<div class="clear"></div>\n\n');80; codeArea() ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],19:[function(require,module,exports){
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
},{"ejs":38}],20:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common'); ; buf.push('\n');2; if (options.feedbackImage) { ; buf.push('\n  <div class="sharing-image">\n    <img class="feedback-image" src="', escape((4,  options.feedbackImage )), '">\n  </div>\n');6; } ; buf.push('\n\n<div class="sharing">\n');9; if (options.alreadySaved) { ; buf.push('\n  <div class="saved-to-gallery">\n    ', escape((11,  msg.savedToGallery() )), '\n  </div>\n');13; } else if (options.saveToGalleryUrl) { ; buf.push('\n  <div class="social-buttons">\n  <button id="save-to-gallery-button" class="launch">\n    ', escape((16,  msg.saveToGallery() )), '\n  </button>\n  </div>\n');19; } ; buf.push('\n\n');21; if (options.response && options.response.level_source) { ; buf.push('\n  ');22; if (options.appStrings && options.appStrings.sharingText) { ; buf.push('\n    <div>', escape((23,  options.appStrings.sharingText )), '</div>\n  ');24; } ; buf.push('\n\n  <div>\n    <input type="text" id="sharing-input" value=', escape((27,  options.response.level_source )), ' readonly>\n  </div>\n\n  <div class=\'social-buttons\'>\n    ');31; if (options.facebookUrl) {; buf.push('      <a href=', escape((31,  options.facebookUrl )), ' target="_blank">\n        <img src=', escape((32,  BlocklyApps.assetUrl("media/facebook_purple.png") )), '>\n      </a>\n    ');34; }; buf.push('  \n    ');35; if (options.twitterUrl) {; buf.push('      <a href=', escape((35,  options.twitterUrl )), ' target="_blank">\n        <img src=', escape((36,  BlocklyApps.assetUrl("media/twitter_purple.png") )), ' >\n      </a>\n    ');38; }; buf.push('  </div>\n');39; } ; buf.push('\n</div>\n\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],21:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/af_za/common'); ; buf.push('\n\n<p id="num-lines-of-code" class="lines-of-code-message">\n  ', escape((4,  msg.numLinesOfCodeWritten({ numLines: numLinesWritten }) )), '\n  <button id="show-code-button" href="#">\n    ', escape((6,  msg.showGeneratedCode() )), '\n  </button>\n</p>\n\n');10; if (totalNumLinesWritten !== 0) { ; buf.push('\n  <p id="total-num-lines-of-code" class="lines-of-code-message">\n    ', escape((12,  msg.totalNumLinesOfCodeWritten({ numLines: totalNumLinesWritten }) )), '\n  </p>\n');14; } ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/common":36,"ejs":38}],22:[function(require,module,exports){
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
},{"ejs":38}],23:[function(require,module,exports){
/**
 * Blockly Demo: Turtle Graphics
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
 * @fileoverview Sample answers for Turtle levels. Used for prompts and marking.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var api = require('./api');
var BlocklyApps = require('../base');

var setRandomVisibleColour = function() {
  var num = Math.floor(Math.random() * Math.pow(2, 24));
  // Make sure at least one component is below 0x80 and the rest
  // below 0xA0, to prevent too light of colours.
  num &= 0x9f7f9f;
  var colour = '#' + ('00000' + num.toString(16)).substr(-6);
  api.penColour(colour);
};

var drawSquare = function(length, random_colour) {
  for (var count = 0; count < 4; count++) {
    if (random_colour) {
      setRandomVisibleColour();
    }
    api.moveForward(length);
    api.turnRight(90);
  }
};

var drawTriangle = function(length, random_colour) {
  for (var count = 0; count < 3; count++) {
    if (random_colour) {
      setRandomVisibleColour();
    }
    api.moveForward(length);
    api.turnRight(120);
  }
};

var drawSnowman = function(height) {
  api.turnLeft(90);
  var distances = [height * 0.5, height * 0.3, height * 0.2];
  for (var i = 0; i < 6; i++) {
    var distance = distances[i < 3 ? i : 5 - i] / 57.5;
    for (var d = 0; d < 180; d += 2) {
      api.moveForward(distance);
      api.turnRight(2);
    }
    if (i != 2) {
      api.turnRight(180);
    }
  }
  api.turnLeft(90);
};

var drawHouse = function(length) {
  drawSquare(length);
  api.moveForward(length);
  api.turnRight(30);
  drawTriangle(length);
  api.turnRight(60);
  api.moveForward(length);
  api.turnLeft(90);
  api.moveBackward(length);
};

/**
 * Returns the log of a sample solutions for each level.
 * To create an answer, just solve the level in Blockly, then paste the
 * resulting JavaScript here, moving any functions to the beginning of
 * this function.
 *
 * Warning: Has side effects to BlocklyApps.
 */
exports.answer = function(page, level) {
  BlocklyApps.log = [];
  BlocklyApps.ticks = Infinity;
  var count, sideIdx, len;
  if (page == 1) {
    switch (level) {
      case 1:
        // El.
        api.moveForward(100);
        api.turnRight(90);
        api.moveForward(100);
        break;
      case 2:
        // Square.
        setRandomVisibleColour();
        drawSquare(100, false);
        break;
      case 3:
        // Use repeat to draw a square.
        drawSquare(100, false);
        break;
      case 4:
        // Equilateral triangle.
        drawTriangle(100, true);
        break;
      case 5:
        // Sideways envelope.
        drawSquare(100);
        drawTriangle(100);
        break;
      case 6:
        // Triangle and square.
        drawTriangle(100);
        api.turnRight(180);
        drawSquare(100);
        break;
      case 7:
        // Glasses.
        api.penColour('#00cc00');  // blue
        api.turnRight(90);
        drawSquare(100);
        api.moveBackward(150);
        drawSquare(100);
        break;
      case 8:
        // Spiky.
        for (count = 0; count < 8; count++) {
          setRandomVisibleColour();
          api.moveForward(100);
          api.moveBackward(100);
          api.turnRight(45);
        }
        break;
      case 9:
        // Circle.
        for (count = 0; count < 360; count++) {
          api.moveForward(1);
          api.turnRight(1);
        }
        break;
    }
  } else if (page == 2) {
    switch (level) {
      case 1:
        // Single square in some color.
        setRandomVisibleColour();
        drawSquare(100);
        break;
      case 2:
        // Single green square.
        api.penColour('#00ff00');  // green
        drawSquare(50);
        break;
      case 3:
        // Three squares, 120 degrees apart, in random colors.
        for (count = 0; count < 3; count++) {
          setRandomVisibleColour();
          drawSquare(100);
          api.turnRight(120);
        }
        break;
      case 4:
        // 36 squares, 10 degrees apart, in random colors.
        for (count = 0; count < 36; count++) {
          setRandomVisibleColour();
          drawSquare(100);
          api.turnRight(10);
        }
        break;
      case 5:  // Draw without using for-loop.  (Fall through to next case.)
      case 6:
        // Squares with sides of 50, 60, 70, 80, and 90 pixels.
        for (len = 50; len <= 90; len += 10) {
          drawSquare(len);
        }
        break;
      case 7:
        // Mini-spiral.
        for (len = 25; len <= 60; len += 5) {
          api.moveForward(len);
          api.turnRight(90);
        }
        break;
      case 7.5:
        drawSnowman(250);
        drawSnowman(100);
        break;
      case 8:
        // Same-height snowmen.
        for (var i = 0; i < 3; i++) {
          setRandomVisibleColour();
          drawSnowman(150);
          api.turnRight(90);
          api.jumpForward(100);
          api.turnLeft(90);
        }
        break;
      case 9:
        // Different height snowmen.
        for (var height = 110; height >= 70; height -= 10) {
          setRandomVisibleColour();
          drawSnowman(height);
          api.turnRight(90);
          api.jumpForward(60);
          api.turnLeft(90);
        }
        break;
    }
  } else if (page == 3) {
    switch (level) {
      case 1:
        // Draw a square.
        drawSquare(100);
        break;
      case 2:
        // Draw a triangle.
        drawTriangle(100);
        break;
      case 3:
        drawTriangle(100);
        api.moveForward(100);
        drawSquare(100);
        api.moveForward(100);
        drawTriangle(100);
        break;
      case 4:
        // Draw a house using "draw a square" and "draw a triangle".
        drawHouse(100);
        break;
      case 5:
        // Draw a house using a function.
        drawHouse(100);
        break;
      case 6:
        setRandomVisibleColour();
        drawTriangle(100);
        api.moveForward(100);
        setRandomVisibleColour();
        drawTriangle(200);
        break;
      case 7:
        // Add a parameter to the "draw a house" procedure.
        drawHouse(150);
        break;
      case 8:
        drawHouse(100);
        drawHouse(150);
        drawHouse(100);
        break;
      case 9:
        for (count = 50; count <= 150; count += 50) {
          setRandomVisibleColour();
          drawHouse(count);
        }
        break;
    }
  } else if (page == 4) {
    switch (level) {
      case 1:
        // Draw an equilateral triangle.
        drawTriangle(100);
        break;
      case 2:
        // Draw two equilateral triangles.
        for (count = 0; count < 2; count++) {
          setRandomVisibleColour();
          drawTriangle(100);
          api.turnRight(90);
        }
        break;
      case 3:
        // Draw four equilateral triangles.
        for (count = 0; count < 4; count++) {
          setRandomVisibleColour();
          drawTriangle(100);
          api.turnRight(90);
        }
        break;
      case 4:
        for (count = 0; count < 10; count++) {
          setRandomVisibleColour();
          drawTriangle(100);
          api.turnRight(36);
        }
        break;
      case 5:
        for (count = 0; count < 36; count++) {
          setRandomVisibleColour();
          drawTriangle(100);
          api.turnRight(10);
        }
        break;
      case 6:
        drawSquare(20);
        break;
      case 7:
        for (count = 0; count < 10; count++) {
          setRandomVisibleColour();
          drawSquare(20);
          api.moveForward(20);
        }
      break;
      case 8:
        for (sideIdx = 0; sideIdx < 4; sideIdx++) {
          for (count = 0; count < 10; count++) {
            setRandomVisibleColour();
            drawSquare(20);
            api.moveForward(20);
          }
          api.turnRight(90);
        }
      break;
      case 9:
        for (sideIdx = 0; sideIdx < 4; sideIdx++) {
          for (count = 0; count < 10; count++) {
            setRandomVisibleColour();
            drawSquare(20);
            api.moveForward(20);
          }
          api.turnRight(80);
        }
      break;
      case 10:
        for (sideIdx = 0; sideIdx < 9; sideIdx++) {
          for (count = 0; count < 10; count++) {
            setRandomVisibleColour();
            drawSquare(20);
            api.moveForward(20);
          }
          api.turnRight(80);
        }
      break;
    }
  }
  BlocklyApps.reset();
  return BlocklyApps.log;
};

},{"../base":2,"./api":24}],24:[function(require,module,exports){
var BlocklyApps = require('../base');

exports.moveForward = function(distance, id) {
  BlocklyApps.log.push(['FD', distance, id]);
};

exports.moveBackward = function(distance, id) {
  BlocklyApps.log.push(['FD', -distance, id]);
};

exports.moveUp = function(distance, id) {
  BlocklyApps.log.push(['MV', distance, 0, id]);
};

exports.moveDown = function(distance, id) {
  BlocklyApps.log.push(['MV', distance, 180, id]);
};

exports.moveLeft = function(distance, id) {
  BlocklyApps.log.push(['MV', distance, 270, id]);
};

exports.moveRight = function(distance, id) {
  BlocklyApps.log.push(['MV', distance, 90, id]);
};

exports.jumpUp = function(distance, id) {
  BlocklyApps.log.push(['JD', distance, 0, id]);
};

exports.jumpDown = function(distance, id) {
  BlocklyApps.log.push(['JD', distance, 180, id]);
};

exports.jumpLeft = function(distance, id) {
  BlocklyApps.log.push(['JD', distance, 270, id]);
};

exports.jumpRight = function(distance, id) {
  BlocklyApps.log.push(['JD', distance, 90, id]);
};

exports.jumpForward = function(distance, id) {
  BlocklyApps.log.push(['JF', distance, id]);
};

exports.jumpBackward = function(distance, id) {
  BlocklyApps.log.push(['JF', -distance, id]);
};

exports.turnRight = function(angle, id) {
  BlocklyApps.log.push(['RT', angle, id]);
};

exports.turnLeft = function(angle, id) {
  BlocklyApps.log.push(['RT', -angle, id]);
};

exports.penUp = function(id) {
  BlocklyApps.log.push(['PU', id]);
};

exports.penDown = function(id) {
  BlocklyApps.log.push(['PD', id]);
};

exports.penWidth = function(width, id) {
  BlocklyApps.log.push(['PW', Math.max(width, 0), id]);
};

exports.penColour = function(colour, id) {
  BlocklyApps.log.push(['PC', colour, id]);
};

exports.hideTurtle = function(id) {
  BlocklyApps.log.push(['HT', id]);
};

exports.showTurtle = function(id) {
  BlocklyApps.log.push(['ST', id]);
};

},{"../base":2}],25:[function(require,module,exports){
/**
 * Blockly Demo: Turtle Graphics
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
 * @fileoverview Demonstration of Blockly: Turtle Graphics.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

var Colours = require('./core').Colours;
var msg = require('../../locale/af_za/turtle');
var commonMsg = require('../../locale/af_za/common');

// Install extensions to Blockly's language and JavaScript generator.
exports.install = function(blockly, skin) {

  var generator = blockly.Generator.get('JavaScript');
  blockly.JavaScript = generator;

  var gensym = function(name) {
    var NAME_TYPE = blockly.Variables.NAME_TYPE;
    return generator.variableDB_.getDistinctName(name, NAME_TYPE);
  };

  // Create a smaller palette.
  blockly.FieldColour.COLOURS = [
    // Row 1.
    Colours.BLACK, Colours.GREY,
    Colours.KHAKI, Colours.WHITE,
    // Row 2.
    Colours.RED, Colours.PINK,
    Colours.ORANGE, Colours.YELLOW,
    // Row 3.
    Colours.GREEN, Colours.BLUE,
    Colours.AQUAMARINE, Colours.PLUM];
  blockly.FieldColour.COLUMNS = 4;

  // Block definitions.
  blockly.Blocks.draw_move_by_constant = {
    // Block for moving forward or backward the internal number of pixels.
    helpUrl: 'http://www.example.com/',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_move.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(new blockly.FieldTextInput('100',
            blockly.FieldTextInput.numberValidator), 'VALUE')
          .appendTitle(msg.dots());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.moveForwardTooltip());
    }
  };

  generator.draw_move_by_constant = function() {
    // Generate JavaScript for moving forward or backward the internal number of
    // pixels.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };


  blockly.Blocks.draw_turn_by_constant_restricted = {
    // Block for turning either left or right from among a fixed set of angles.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_turn.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.VALUE), 'VALUE')
          .appendTitle(msg.degrees());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.turnTooltip());
    }
  };

  blockly.Blocks.draw_turn_by_constant_restricted.VALUE =
      [30, 45, 60, 90, 120, 135, 150, 180].
      map(function(t) {return [String(t), String(t)];});

  generator.draw_turn_by_constant_restricted = function() {
    // Generate JavaScript for turning either left or right from among a fixed
    // set of angles.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_turn_by_constant = {
    // Block for turning left or right any number of degrees.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_turn.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(new blockly.FieldTextInput('90',
              blockly.FieldTextInput.numberValidator), 'VALUE')
          .appendTitle(msg.degrees());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.turnTooltip());
    }
  };

  generator.draw_turn_by_constant = function() {
    // Generate JavaScript for turning left or right.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  generator.draw_move_inline = function() {
    // Generate JavaScript for moving forward or backward the internal number of
    // pixels.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };


  blockly.Blocks.draw_turn_inline_restricted = {
    // Block for turning either left or right from among a fixed set of angles.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_turn.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.VALUE), 'VALUE')
          .appendTitle(msg.degrees());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.turnTooltip());
    }
  };

  blockly.Blocks.draw_turn_inline_restricted.VALUE =
      [30, 45, 60, 90, 120, 135, 150, 180].
      map(function(t) {return [String(t), String(t)];});

  generator.draw_turn_inline_restricted = function() {
    // Generate JavaScript for turning either left or right from among a fixed
    // set of angles.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_turn_inline = {
    // Block for turning left or right any number of degrees.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_turn.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(new blockly.FieldTextInput('90',
              blockly.FieldTextInput.numberValidator), 'VALUE')
          .appendTitle(msg.degrees());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.turnTooltip());
    }
  };

  generator.draw_turn_inline = function() {
    // Generate JavaScript for turning left or right.
    var value = window.parseFloat(this.getTitleValue('VALUE'));
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.variables_get_counter = {
    // Variable getter.
    category: null,  // Variables are handled specially.
    helpUrl: blockly.Msg.VARIABLES_GET_HELPURL,
    init: function() {
      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(blockly.Msg.VARIABLES_GET_TITLE)
          .appendTitle(new blockly.FieldLabel(msg.loopVariable()), 'VAR');
      this.setOutput(true);
      this.setTooltip(blockly.Msg.VARIABLES_GET_TOOLTIP);
    },
    getVars: function() {
      return [this.getTitleValue('VAR')];
    }
  };

  generator.variables_get_counter = generator.variables_get;

  blockly.Blocks.variables_get_length = {
    // Variable getter.
    category: null,  // Variables are handled specially.
    helpUrl: blockly.Msg.VARIABLES_GET_HELPURL,
    init: function() {
      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(blockly.Msg.VARIABLES_GET_TITLE)
          .appendTitle(new blockly.FieldLabel(msg.lengthParameter()), 'VAR');
      this.setOutput(true);
      this.setTooltip(blockly.Msg.VARIABLES_GET_TOOLTIP);
    },
    getVars: function() {
      return [this.getTitleValue('VAR')];
    }
  };

  generator.variables_get_length = generator.variables_get;

  blockly.Blocks.variables_get_sides = {
    // Variable getter.
    category: null,  // Variables are handled specially.
    helpUrl: blockly.Msg.VARIABLES_GET_HELPURL,
    init: function() {
      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(blockly.Msg.VARIABLES_GET_TITLE)
          .appendTitle(new blockly.FieldLabel('sides'), 'VAR');
      this.setOutput(true);
      this.setTooltip(blockly.Msg.VARIABLES_GET_TOOLTIP);
    },
    getVars: function() {
      return [this.getTitleValue('VAR')];
    }
  };

  generator.variables_get_sides = generator.variables_get;

  // Create a fake "draw a square" function so it can be made available to users
  // without being shown in the workspace.
  blockly.Blocks.draw_a_square = {
    // Draw a square.
    init: function() {
      this.setHSV(94, 0.84, 0.60);
      this.appendDummyInput()
          .appendTitle(msg.drawASquare());
      this.appendValueInput('VALUE')
          .setAlign(blockly.ALIGN_RIGHT)
          .setCheck('Number')
              .appendTitle(msg.lengthParameter() + ':');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip('');
    }
  };

  generator.draw_a_square = function() {
    // Generate JavaScript for drawing a square.
    var value_length = generator.valueToCode(
        this, 'VALUE', generator.ORDER_ATOMIC);
    var loopVar = gensym('count');
    return [
        // The generated comment helps detect required blocks.
        // Don't change it without changing REQUIRED_BLOCKS.
        '// draw_a_square',
        'for (var ' + loopVar + ' = 0; ' + loopVar + ' < 4; ' +
              loopVar + '++) {',
        '  Turtle.moveForward(' + value_length + ');',
        '  Turtle.turnRight(90);',
        '}\n'].join('\n');
  };

  // Create a fake "draw a snowman" function so it can be made available to
  // users without being shown in the workspace.
  blockly.Blocks.draw_a_snowman = {
    // Draw a circle in front of the turtle, ending up on the opposite side.
    init: function() {
      this.setHSV(94, 0.84, 0.60);
      this.appendDummyInput()
          .appendTitle(msg.drawASnowman());
      this.appendValueInput('VALUE')
          .setAlign(blockly.ALIGN_RIGHT)
          .setCheck('Number')
          .appendTitle(msg.lengthParameter() + ':');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip('');
    }
  };

  generator.draw_a_snowman = function() {
    // Generate JavaScript for drawing a snowman in front of the turtle.
    var value = generator.valueToCode(
        this, 'VALUE', generator.ORDER_ATOMIC);
    var distancesVar = gensym('distances');
    var loopVar = gensym('counter');
    var degreeVar = gensym('degree');
    var distanceVar = gensym('distance');
    return [
      // The generated comment helps detect required blocks.
      // Don't change it without changing REQUIRED_BLOCKS.
      '// draw_a_snowman',
      'Turtle.turnLeft(90);',
      'var ' + distancesVar + ' = [' + value + ' * 0.5, ' + value + ' * 0.3,' +
          value + ' * 0.2];',
      'for (var ' + loopVar + ' = 0; ' + loopVar + ' < 6; ' +
          loopVar + '++) {\n',
      '  var ' + distanceVar + ' = ' + distancesVar + '[' + loopVar +
          ' < 3 ? ' + loopVar + ': 5 - ' + loopVar + '] / 57.5;',
      '  for (var ' + degreeVar + ' = 0; ' + degreeVar + ' < 90; ' +
          degreeVar + '++) {',
      '    Turtle.moveForward(' + distanceVar + ');',
      '    Turtle.turnRight(2);',
      '  }',
      '  if (' + loopVar + ' != 2) {',
      '    Turtle.turnLeft(180);',
      '  }',
      '}',
      'Turtle.turnLeft(90);\n'].join('\n');
  };

  // This is a modified copy of blockly.Blocks.controls_for with the
  // variable named "counter" hardcoded.
  blockly.Blocks.controls_for_counter = {
    // For loop with hardcoded loop variable.
    helpUrl: blockly.Msg.CONTROLS_FOR_HELPURL,
    init: function() {
      this.setHSV(322, 0.90, 0.95);
      this.appendDummyInput()
          .appendTitle(blockly.Msg.CONTROLS_FOR_INPUT_WITH)
          .appendTitle(new blockly.FieldLabel(msg.loopVariable()),
                       'VAR');
      this.interpolateMsg(blockly.Msg.CONTROLS_FOR_INPUT_FROM_TO_BY,
                        ['FROM', 'Number', blockly.ALIGN_RIGHT],
                        ['TO', 'Number', blockly.ALIGN_RIGHT],
                        ['BY', 'Number', blockly.ALIGN_RIGHT],
                        blockly.ALIGN_RIGHT);
      this.appendStatementInput('DO')
          .appendTitle(Blockly.Msg.CONTROLS_FOR_INPUT_DO);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip(blockly.Msg.CONTROLS_FOR_TOOLTIP.replace(
          '%1', this.getTitleValue('VAR')));
    },
    getVars: function() {
      return [this.getTitleValue('VAR')];
    },
    customContextMenu: function(options) {
      var option = {enabled: true};
      var name = this.getTitleValue('VAR');
      option.text = blockly.Msg.VARIABLES_SET_CREATE_GET.replace('%1', name);
      var xmlTitle = document.createElement('title');
      xmlTitle.appendChild(document.createTextNode(name));
      xmlTitle.setAttribute('name', 'VAR');
      var xmlBlock = document.createElement('block');
      xmlBlock.appendChild(xmlTitle);
      xmlBlock.setAttribute('type', 'variables_get_counter');
      option.callback = blockly.ContextMenu.callbackFactory(this, xmlBlock);
      options.push(option);
    }
  };

  generator.controls_for_counter = generator.controls_for;

  // Delete these standard blocks.
  delete blockly.Blocks.procedures_defreturn;
  delete blockly.Blocks.procedures_ifreturn;

  // General blocks.

  blockly.Blocks.draw_move = {
    // Block for moving forward or backwards.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_move.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(msg.dots());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.moveTooltip());
    }
  };

  blockly.Blocks.draw_move.DIRECTIONS =
      [[msg.moveForward(), 'moveForward'],
       [msg.moveBackward(), 'moveBackward']];

  generator.draw_move = function() {
    // Generate JavaScript for moving forward or backwards.
    var value = generator.valueToCode(this, 'VALUE',
        generator.ORDER_NONE) || '0';
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.jump = {
    // Block for moving forward or backwards.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.jump.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(msg.dots());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.jumpTooltip());
    }
  };

  var SimpleMove = {
    DEFAULT_MOVE_LENGTH: 50,
    SHORT_MOVE_LENGTH: 25,
    LONG_MOVE_LENGTH: 100,
    DIRECTION_CONFIGS: {
      left: { letter: commonMsg.directionWestLetter(), moveFunction: 'moveLeft', image: skin.leftArrow, image_width: 42, image_height: 42 },
      right: { letter: commonMsg.directionEastLetter(), moveFunction: 'moveRight', image: skin.rightArrow, image_width: 42, image_height: 42 },
      up: { letter: commonMsg.directionNorthLetter(), moveFunction: 'moveUp', image: skin.upArrow, image_width: 42, image_height: 42 },
      down: { letter: commonMsg.directionSouthLetter(), moveFunction: 'moveDown', image: skin.downArrow, image_width: 42, image_height: 42 },
      jump_left: { letter: commonMsg.directionWestLetter(), moveFunction: 'jumpLeft', image: skin.leftJumpArrow, image_width: 42, image_height: 42 },
      jump_right: { letter: commonMsg.directionEastLetter(), moveFunction: 'jumpRight', image: skin.rightJumpArrow, image_width: 42, image_height: 42 },
      jump_up: { letter: commonMsg.directionNorthLetter(), moveFunction: 'jumpUp', image: skin.upJumpArrow, image_width: 42, image_height: 42 },
      jump_down: { letter: commonMsg.directionSouthLetter(), moveFunction: 'jumpDown', image: skin.downJumpArrow, image_width: 42, image_height: 42 },
    },
    LENGTHS: [
      [skin.shortLineDraw, "SHORT_MOVE_LENGTH"],
      [skin.longLineDraw, "LONG_MOVE_LENGTH"]
    ],
    generateBlocksForAllDirections: function() {
      SimpleMove.generateBlocksForDirection("up");
      SimpleMove.generateBlocksForDirection("down");
      SimpleMove.generateBlocksForDirection("left");
      SimpleMove.generateBlocksForDirection("right");
    },
    generateBlocksForDirection: function(direction) {
      generator["simple_move_" + direction] = SimpleMove.generateCodeGenerator(direction);
      generator["simple_jump_" + direction] = SimpleMove.generateCodeGenerator('jump_' + direction);
      generator["simple_move_" + direction + "_length"] = SimpleMove.generateCodeGenerator(direction, true);
      blockly.Blocks['simple_move_' + direction + '_length'] = SimpleMove.generateMoveBlock(direction, true);
      blockly.Blocks['simple_move_' + direction] = SimpleMove.generateMoveBlock(direction);
      blockly.Blocks['simple_jump_' + direction] = SimpleMove.generateJumpBlock('jump_' + direction);
    },
    generateMoveBlock: function(direction, hasLengthInput) {
      var directionConfig = SimpleMove.DIRECTION_CONFIGS[direction];
      return {
        helpUrl: '',
        init: function () {
          this.setHSV(184, 1.00, 0.74);
          var input = this.appendDummyInput().appendTitle(directionConfig.letter)
            .appendTitle(new blockly.FieldImage(directionConfig.image));
          this.setPreviousStatement(true);
          this.setNextStatement(true);
          if (hasLengthInput) {
            var dropdown = new blockly.FieldImageDropdown(SimpleMove.LENGTHS);
            dropdown.setValue(SimpleMove.LENGTHS[0][1]);
            input.appendTitle(dropdown, 'length');
          }
        }
      };
    },
    generateJumpBlock: function(direction) {
      var directionConfig = SimpleMove.DIRECTION_CONFIGS[direction];
      return {
        helpUrl: '',
        init: function () {
          this.setHSV(184, 1.00, 0.74);
          this.appendDummyInput().appendTitle(commonMsg.jump() + " " + directionConfig.letter);
          this.appendDummyInput().appendTitle(new blockly.FieldImage(directionConfig.image));
          this.setPreviousStatement(true);
          this.setNextStatement(true);
        }
      };
    },
    generateCodeGenerator: function(direction, hasLengthInput, length) {
      return function() {
        length = length || SimpleMove.DEFAULT_MOVE_LENGTH;

        if (hasLengthInput) {
          length = SimpleMove[this.getTitleValue("length")];
        }
        return 'Turtle.' + SimpleMove.DIRECTION_CONFIGS[direction].moveFunction + '(' + length + ',' + '\'block_id_' + this.id + '\');\n';
      };
    }
  };

  SimpleMove.generateBlocksForAllDirections();

  blockly.Blocks.jump.DIRECTIONS =
      [[msg.jumpForward(), 'jumpForward'],
       [msg.jumpBackward(), 'jumpBackward']];

  generator.jump = function() {
    // Generate JavaScript for jumping forward or backwards.
    var value = generator.valueToCode(this, 'VALUE',
        generator.ORDER_NONE) || '0';
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_turn = {
    // Block for turning left or right.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendValueInput('VALUE')
          .setCheck('Number')
          .appendTitle(new blockly.FieldDropdown(
              blockly.Blocks.draw_turn.DIRECTIONS), 'DIR');
      this.appendDummyInput()
          .appendTitle(msg.degrees());
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.turnTooltip());
    }
  };

  blockly.Blocks.draw_turn.DIRECTIONS =
      [[msg.turnRight(), 'turnRight'],
       [msg.turnLeft(), 'turnLeft']];

  generator.draw_turn = function() {
    // Generate JavaScript for turning left or right.
    var value = generator.valueToCode(this, 'VALUE',
        generator.ORDER_NONE) || '0';
    return 'Turtle.' + this.getTitleValue('DIR') +
        '(' + value + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_width = {
    // Block for setting the pen width.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendValueInput('WIDTH')
          .setCheck('Number')
          .appendTitle(msg.setWidth());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.widthTooltip());
    }
  };

  generator.draw_width = function() {
    // Generate JavaScript for setting the pen width.
    var width = generator.valueToCode(this, 'WIDTH',
        generator.ORDER_NONE) || '1';
    return 'Turtle.penWidth(' + width + ', \'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_pen = {
    // Block for pen up/down.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.STATE), 'PEN');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.penTooltip());
    }
  };

  blockly.Blocks.draw_pen.STATE =
      [[msg.penUp(), 'penUp'],
       [msg.penDown(), 'penDown']];

  generator.draw_pen = function() {
    // Generate JavaScript for pen up/down.
    return 'Turtle.' + this.getTitleValue('PEN') +
        '(\'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.draw_colour = {
    // Block for setting the colour.
    helpUrl: '',
    init: function() {
      this.setHSV(42, 0.89, 0.99);
      this.appendValueInput('COLOUR')
          .setCheck('Colour')
          .appendTitle(msg.setColour());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setInputsInline(true);
      this.setTooltip(msg.colourTooltip());
    }
  };

  generator.draw_colour = function() {
    // Generate JavaScript for setting the colour.
    var colour = generator.valueToCode(this, 'COLOUR',
        generator.ORDER_NONE) || '\'#000000\'';
    return 'Turtle.penColour(' + colour + ', \'block_id_' +
        this.id + '\');\n';
  };

  blockly.Blocks.draw_colour_simple = {
    // Simplified dropdown block for setting the colour.
    init: function() {
      var colours = [Colours.RED, Colours.BLACK, Colours.PINK, Colours.ORANGE,
        Colours.YELLOW, Colours.GREEN, Colours.BLUE, Colours.AQUAMARINE, Colours.PLUM];
      this.setHSV(42, 0.89, 0.99);
      var colourField = new Blockly.FieldColourDropdown(colours, 45, 35);
      this.appendDummyInput()
          .appendTitle(msg.setColour())
          .appendTitle(colourField, 'COLOUR');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.colourTooltip());
    }
  };

  generator.draw_colour_simple = function() {
    // Generate JavaScript for setting the colour.
    var colour = this.getTitleValue('COLOUR') || '\'#000000\'';
    return 'Turtle.penColour("' + colour + '", \'block_id_' +
        this.id + '\');\n';
  };

  blockly.Blocks.up_big = {
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.appendDummyInput()
        .appendTitle(new blockly.FieldDropdown(this.STATE), 'VISIBILITY');
      this.setTooltip(msg.turtleVisibilityTooltip());
    }
  };

  generator.up_big = function() {
    // Generate JavaScript for setting the colour.
    var colour = generator.valueToCode(this, 'COLOUR',
      generator.ORDER_NONE) || '\'#000000\'';
    return 'Turtle.penColour(' + colour + ', \'block_id_' +
      this.id + '\');\n';
  };

  blockly.Blocks.turtle_visibility = {
    // Block for changing turtle visiblity.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.appendDummyInput()
          .appendTitle(new blockly.FieldDropdown(this.STATE), 'VISIBILITY');
      this.setTooltip(msg.turtleVisibilityTooltip());
    }
  };

  blockly.Blocks.turtle_visibility.STATE =
      [[msg.hideTurtle(), 'hideTurtle'],
       [msg.showTurtle(), 'showTurtle']];

  generator.turtle_visibility = function() {
    // Generate JavaScript for changing turtle visibility.
    return 'Turtle.' + this.getTitleValue('VISIBILITY') +
        '(\'block_id_' + this.id + '\');\n';
  };

};

},{"../../locale/af_za/common":36,"../../locale/af_za/turtle":37,"./core":27}],26:[function(require,module,exports){
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
 buf.push('<td id="slider-cell" style="width: 150px;">\n  <svg id="slider"\n       xmlns="http://www.w3.org/2000/svg"\n       xmlns:svg="http://www.w3.org/2000/svg"\n       xmlns:xlink="http://www.w3.org/1999/xlink"\n       version="1.1"\n       width="150"\n       height="50">\n      <!-- Slow icon. -->\n      <clipPath id="slowClipPath">\n        <rect width=26 height=12 x=5 y=14 />\n      </clipPath>\n      <image xlink:href="', escape((13,  assetUrl('media/turtle/icons.png') )), '" height=42 width=84 x=-21 y=-10\n          clip-path="url(#slowClipPath)" />\n      <!-- Fast icon. -->\n      <clipPath id="fastClipPath">\n        <rect width=26 height=16 x=120 y=10 />\n      </clipPath>\n      <image xlink:href="', escape((19,  assetUrl('media/turtle/icons.png') )), '" height=42 width=84 x=120 y=-11\n          clip-path="url(#fastClipPath)" />\n  </svg>\n</td>\n<td style="width: 15px;">\n  <img id="spinner" style="visibility: hidden;" src="', escape((24,  assetUrl('media/turtle/loading.gif') )), '" height=15 width=15>\n</td>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":38}],27:[function(require,module,exports){
// Create a limited colour palette to avoid overwhelming new users
// and to make colour checking easier.  These definitions cannot be
// moved to blocks.js, which is loaded later, since they are used in
// top-level definitions below.  Note that the hex digits a-f are
// lower-case.  This is assumed in comparisons below.
exports.Colours = {
  BLACK: '#000000',
  GREY: '#808080',
  KHAKI: '#c3b091',
  WHITE: '#ffffff',
  RED: '#ff0000',
  PINK: '#ff77ff',
  ORANGE: '#ffa000',
  YELLOW: '#ffff00',
  GREEN: '#228b22',
  BLUE: '#0000cd',
  AQUAMARINE: '#7fffd4',
  PLUM: '#843179'
};

},{}],28:[function(require,module,exports){
var levelBase = require('../level_base');
var Colours = require('./core').Colours;
var answer = require('./answers').answer;
var msg = require('../../locale/af_za/turtle');
var blockUtils = require('../block_utils');

//TODO: Fix hacky level-number-dependent toolbox.
var toolbox = function(page, level) {
  return require('./toolbox.xml')({
    page: page,
    level: level
  });
};

//TODO: Fix hacky level-number-dependent startBlocks.
var startBlocks = function(page, level) {
  return require('./startBlocks.xml')({
    page: page,
    level: level
  });
};

var req = require('./requiredBlocks');
var makeMathNumber = req.makeMathNumber;
var simpleBlock = req.simpleBlock;
var repeat = req.repeat;
var drawASquare = req.drawASquare;
var drawASnowman = req.drawASnowman;
var MOVE_FORWARD_INLINE = req.MOVE_FORWARD_INLINE;
var MOVE_FORWARD_OR_BACKWARD_INLINE = req.MOVE_FORWARD_OR_BACKWARD_INLINE;
var moveForwardInline = req.moveForwardInline;
var MOVE_BACKWARD_INLINE = req.MOVE_BACKWARD_INLINE;
var turnRightRestricted = req.turnRightRestricted;
var turnRightByConstant = req.turnRightByConstant;
var turnRight = req.turnRight;
var turnLeft = req.turnLeft;
var move = req.move;
var drawTurnRestricted = req.drawTurnRestricted;
var drawTurn = req.drawTurn;
var SET_COLOUR_PICKER = req.SET_COLOUR_PICKER;
var SET_COLOUR_RANDOM = req.SET_COLOUR_RANDOM;
var defineWithArg = req.defineWithArg;

var blocks = {
  SIMPLE_MOVE_UP: blockUtils.blockOfType('simple_move_up'),
  SIMPLE_MOVE_DOWN: blockUtils.blockOfType('simple_move_down'),
  SIMPLE_MOVE_LEFT: blockUtils.blockOfType('simple_move_left'),
  SIMPLE_MOVE_RIGHT: blockUtils.blockOfType('simple_move_right'),
  SIMPLE_JUMP_UP: blockUtils.blockOfType('simple_jump_up'),
  SIMPLE_JUMP_DOWN: blockUtils.blockOfType('simple_jump_down'),
  SIMPLE_JUMP_LEFT: blockUtils.blockOfType('simple_jump_left'),
  SIMPLE_JUMP_RIGHT: blockUtils.blockOfType('simple_jump_right'),
  SIMPLE_MOVE_UP_LENGTH: blockUtils.blockOfType('simple_move_up_length'),
  SIMPLE_MOVE_DOWN_LENGTH: blockUtils.blockOfType('simple_move_down_length'),
  SIMPLE_MOVE_LEFT_LENGTH: blockUtils.blockOfType('simple_move_left_length'),
  SIMPLE_MOVE_RIGHT_LENGTH: blockUtils.blockOfType('simple_move_right_length'),
  simpleMoveBlocks: function() {
    return this.SIMPLE_MOVE_UP +
      this.SIMPLE_MOVE_DOWN +
      this.SIMPLE_MOVE_LEFT +
      this.SIMPLE_MOVE_RIGHT;
  },
  simpleJumpBlocks: function() {
    return this.SIMPLE_JUMP_UP +
      this.SIMPLE_JUMP_DOWN +
      this.SIMPLE_JUMP_LEFT +
      this.SIMPLE_JUMP_RIGHT;
  },
  simpleMoveLengthBlocks: function() {
    return this.SIMPLE_MOVE_UP_LENGTH +
      this.SIMPLE_MOVE_DOWN_LENGTH +
      this.SIMPLE_MOVE_LEFT_LENGTH +
      this.SIMPLE_MOVE_RIGHT_LENGTH;
  }
};

/**
 * Information about level-specific requirements.
 */
module.exports = {
  // Level 1: El.
  '1_1': {
    answer: answer(1, 1),
    ideal: 3,
    toolbox: toolbox(1, 1),
    startBlocks: startBlocks(1, 1),
    requiredBlocks: [[MOVE_FORWARD_INLINE], [turnRightRestricted(90)]],
    freePlay: false
  },
  // Level 2: Square (without repeat).
  '1_2': {
    answer: answer(1, 2),
    ideal: 10,
    toolbox: toolbox(1, 2),
    startBlocks: startBlocks(1, 2),
    requiredBlocks: [
      [MOVE_FORWARD_INLINE],
      [turnRightRestricted(90)]
    ],
    freePlay: false
  },
  // Level 3: Square (with repeat).
  '1_3': {
    answer: answer(1, 3),
    ideal: 3,
    toolbox: toolbox(1, 3),
    startBlocks: startBlocks(1, 3),
    requiredBlocks: [
      [MOVE_FORWARD_INLINE],
      [turnRightRestricted(90)],
      [repeat(4)]
    ],
    freePlay: false
  },
  // Level 4: Triangle.
  '1_4': {
    answer: answer(1, 4),
    ideal: 5,
    toolbox: toolbox(1, 4),
    startBlocks: startBlocks(1, 4),
    requiredBlocks: [
      [MOVE_FORWARD_OR_BACKWARD_INLINE],
      [repeat(3)],
      [{
        // allow turn right or left, but show turn right block if they've done neither
        test: function(block) {
          return block.type == 'draw_turn_by_constant_restricted';
        },
        type: 'draw_turn_by_constant',
        titles: {VALUE: '???'}
      }]
    ],
    freePlay: false
  },
  // Level 5: Envelope.
  '1_5': {
    answer: answer(1, 5),
    ideal: 6,
    toolbox: toolbox(1, 5),
    startBlocks: startBlocks(1, 5),
    requiredBlocks: [
      [repeat(3)],
      [turnRightRestricted(120)],
      [MOVE_FORWARD_INLINE]
    ],
    freePlay: false
  },
  // Level 6: triangle and square.
  '1_6': {
    answer: answer(1, 6),
    ideal: 7,
    toolbox: toolbox(1, 6),
    startBlocks: startBlocks(1, 6),
    requiredBlocks: [
      [repeat(3)],
      [turnRightRestricted(120)],
      [MOVE_FORWARD_INLINE],
      [MOVE_BACKWARD_INLINE, MOVE_FORWARD_INLINE]
    ],
    freePlay: false
  },
  // Level 7: glasses.
  '1_7': {
    answer: answer(1, 7),
    ideal: 12,
    toolbox: toolbox(1, 7),
    startBlocks: startBlocks(1, 7),
    requiredBlocks: [
      [drawTurnRestricted(90)],
      [MOVE_FORWARD_INLINE],
      [repeat(4)],
      [MOVE_BACKWARD_INLINE, MOVE_FORWARD_INLINE]
    ],
    freePlay: false,
    startDirection: 0
  },
  // Level 8: spikes.
  '1_8': {
    answer: answer(1, 8),
    ideal: 6,
    toolbox: toolbox(1, 8),
    startBlocks: startBlocks(1, 8),
    requiredBlocks: [[repeat(8)]],
    freePlay: false
  },
  // Level 9: circle.
  '1_9': {
    answer: answer(1, 9),
    ideal: 5,
    toolbox: toolbox(1, 9),
    startBlocks: startBlocks(1, 9),
    requiredBlocks: [],
    freePlay: false,
    sliderSpeed: 0.9,
    permittedErrors: 10,
    failForCircleRepeatValue: true
  },
  // Level 10: playground.
  '1_10': {
    answer: answer(1, 10),
    toolbox: toolbox(1, 10),
    startBlocks: startBlocks(1, 10),
    requiredBlocks: [],
    freePlay: true
  },
  // Formerly Page 2.
  // Level 1: Square.
  '2_1': {
    answer: answer(2, 1),
    ideal: 7,
    toolbox: toolbox(2, 1),
    startBlocks: startBlocks(2, 1),
    requiredBlocks: [
      [repeat(4)],
      [{
        // allow turn right or left, but show turn right block if they've done neither
        test: function(block) {
          return block.type == 'draw_turn';
        },
        type: 'draw_turn',
        titles: {'DIR': 'turnRight'},
        values: {'VALUE': makeMathNumber(90)}
      }],
      [{
        // allow move forward or backward, but show forward block if they've done neither
        test: function(block) {
          return block.type == 'draw_move';
        },
        type: 'draw_move',
        values: {'VALUE': makeMathNumber(100)}
      }],
    ],
    freePlay: false
  },
  // Level 2: Small green square.
  '2_2': {
    answer: answer(2, 2),
    ideal: 4,
    toolbox: toolbox(2, 2),
    startBlocks: startBlocks(2, 2),
    requiredBlocks: [
      [drawASquare('??')]
    ],
    freePlay: false
  },
  // Level 3: Three squares.
  '2_3': {
    answer: answer(2, 3),
    ideal: 7,
    toolbox: toolbox(2, 3),
    startBlocks: startBlocks(2, 3),
    requiredBlocks: [
      [repeat(3)],
      [drawASquare(100)],
      [drawTurn()]
    ],
    freePlay: false
  },
  // Level 4: 36 squares.
  '2_4': {
    answer: answer(2, 4),
    ideal: 7,
    toolbox: toolbox(2, 4),
    startBlocks: startBlocks(2, 4),
    freePlay: false,
    impressive: true
  },
  // Level 5: Different size squares.
  '2_5': {
    answer: answer(2, 5),
    ideal: 10,
    toolbox: toolbox(2, 5),
    startBlocks: startBlocks(2, 5),
    requiredBlocks: [
      [drawASquare('??')]
    ],
    freePlay: false
  },
  // Level 6: For-loop squares.
  '2_6': {
    answer: answer(2, 6),
    ideal: 6,
    toolbox: toolbox(2, 6),
    startBlocks: startBlocks(2, 6),
    // This is not displayed properly.
    requiredBlocks: [[simpleBlock('variables_get_counter')]],
    freePlay: false
  },
  // Level 7: Boxy spiral.
  '2_7': {
    answer: answer(2, 7),
    ideal: 8,
    toolbox: toolbox(2, 7),
    startBlocks: startBlocks(2, 7),
    requiredBlocks: [
      [simpleBlock('controls_for_counter')],
      [move('??')],
      [simpleBlock('variables_get_counter')],
      [turnRight(90)]
    ],
    freePlay: false
  },
  // Prep for Level 8: Two snowmen.
  '2_7_5': {
    answer: answer(2, 7.5),
    initialY: 300,
    ideal: 4,
    toolbox: toolbox(2, 8),
    startBlocks: startBlocks(2, 7.5),
    requiredBlocks: [
      [drawASnowman(250)],
      [drawASnowman(100)]
    ],
    freePlay: false,
    sliderSpeed: 0.9,
    startDirection: 0
  },
  // Level 8: Three snowmen.
  '2_8': {
    answer: answer(2, 8),
    initialX: 100,
    ideal: 11,
    toolbox: toolbox(2, 8),
    startBlocks: startBlocks(2, 8),
    requiredBlocks: [
      [drawASnowman(150)],
      [turnRight(90)],
      [turnLeft(90)],
      [{
        test: 'jump',
        type: 'jump',
        values: {'VALUE': makeMathNumber(100)}
      }],
      [simpleBlock('jump')],
      [repeat(3)]
    ],
    freePlay: false,
    sliderSpeed: 0.9,
    startDirection: 0
  },
  // Level 9: Snowman family.
  '2_9': {
    answer: answer(2, 9),
    initialX: 100,
    ideal: 12,
    toolbox: toolbox(2, 9),
    startBlocks: startBlocks(2, 9),
    requiredBlocks: [
      [drawASnowman('??')],
      [simpleBlock('controls_for_counter')],
      [simpleBlock('variables_get_counter')],
      [turnRight(90)],
      [turnLeft(90)],
      [{
        test: 'jump',
        type: 'jump',
        values: {'VALUE': makeMathNumber(60)}
      }]
    ],
    freePlay: false,
    sliderSpeed: 0.9,
    startDirection: 0
  },
  // Level 10: playground.
  '2_10': {
    answer: answer(2, 10),
    freePlay: true,
    toolbox: toolbox(2, 10),
    startBlocks: startBlocks(2, 10)
  },
  // Formerly Page 3.
  // Level 1: Call 'draw a square'.
  '3_1': {
    answer: answer(3, 1),
    ideal: 13,
    toolbox: toolbox(3, 1),
    startBlocks: startBlocks(3, 1),
    requiredBlocks: [
      [levelBase.call(msg.drawASquare())]
    ],
    freePlay: false
  },
  // Level 2: Create "draw a triangle".
  '3_2': {
    answer: answer(3, 2),
    ideal: 13,
    toolbox: toolbox(3, 2),
    startBlocks: startBlocks(3, 2),
    requiredBlocks: [
      [repeat(3)],
      [move(100)],
      [turnRight(120)],
      [levelBase.call(msg.drawATriangle())]
    ],
    freePlay: false
  },
  // Level 3: Fence the animals.
  '3_3': {
    answer: answer(3, 3),
    initialY: 350,
    ideal: 19,
    toolbox: toolbox(3, 3),
    startBlocks: startBlocks(3, 3),
    requiredBlocks: [
      [levelBase.call(msg.drawATriangle())],
      [move(100)],
      [levelBase.call(msg.drawASquare())]
    ],
    freePlay: false,
    images: [
      {
        filename: 'cat.svg',
        position: [170, 247]
      },
      {
        filename: 'cat.svg',
        position: [170, 47]
      },
      {
        filename: 'cow.svg',
        position: [182, 147]
      }
    ],
    startDirection: 0
  },
  // Level 4: House the lion.
  '3_4': {
    answer: answer(3, 4),
    ideal: 18,
    toolbox: toolbox(3, 4),
    startBlocks: startBlocks(3, 4),
    requiredBlocks: [
      [levelBase.call(msg.drawASquare())],
      [move(100)],
      [turnRight(30)],
      [levelBase.call(msg.drawATriangle())]
    ],
    freePlay: false,
    images: [
      {
        filename: 'lion.svg',
        position: [195, 97]
      }
    ],
    startDirection: 0
  },
  // Level 5: Create "draw a house".
  '3_5': {
    answer: answer(3, 5),
    ideal: 20,
    toolbox: toolbox(3, 5),
    startBlocks: startBlocks(3, 5),
    requiredBlocks: [
      [levelBase.define(msg.drawAHouse())],
      [levelBase.call(msg.drawASquare())],
      [move(100)],
      [turnRight(30)],
      [levelBase.call(msg.drawATriangle())],
      [levelBase.call(msg.drawAHouse())]
    ],
    freePlay: false,
    images: [
      {
        filename: 'cat.svg',
        position: [170, 90]
      },
      {
        filename: 'cat.svg',
        position: [222, 90]
      }
    ],
    startDirection: 0
  },
  // Level 6: Add parameter to "draw a triangle".
  '3_6': {
    answer: answer(3, 6),
    initialY: 350,
    ideal: 22,
    toolbox: toolbox(3, 6),
    startBlocks: startBlocks(3, 6),
    requiredBlocks: [
      [defineWithArg(msg.drawATriangle(), msg.lengthParameter())],
      [simpleBlock('variables_get_length')],
      [levelBase.callWithArg(msg.drawATriangle(), msg.lengthParameter())]
    ],
    freePlay: false,
    images: [
      {
        filename: 'lion.svg',
        position: [185, 100]
      },
      {
        filename: 'cat.svg',
        position: [175, 248]
      }
    ],
    startDirection: 0
  },
  // Level 7: Add parameter to "draw a house".
  '3_7': {
    answer: answer(3, 7),
    initialY: 350,
    ideal: 23,
    toolbox: toolbox(3, 7),
    startBlocks: startBlocks(3, 7),
    requiredBlocks: [
      [defineWithArg(msg.drawAHouse(), msg.lengthParameter())],
      [levelBase.callWithArg(msg.drawASquare(), msg.lengthParameter())],
      [levelBase.callWithArg(msg.drawATriangle(), msg.lengthParameter())],
      [simpleBlock('variables_get_length')],
      [levelBase.callWithArg(msg.drawAHouse(), msg.lengthParameter())]
    ],
    freePlay: false,
    images: [
      {
        filename: 'elephant.svg',
        position: [205, 220]
      }
    ],
    startDirection: 0
  },
  // Level 8: Draw houses.
  '3_8': {
    answer: answer(3, 8),
    initialX: 20,
    initialY: 350,
    ideal: 39,
    toolbox: toolbox(3, 8),
    startBlocks: startBlocks(3, 8),
    freePlay: false,
    images: [
      {
        filename: 'cat.svg',
        position: [16, 170]
      },
      {
        filename: 'lion.svg',
        position: [15, 250]
      },
      {
        filename: 'elephant.svg',
        position: [127, 220]
      },
      {
        filename: 'cow.svg',
        position: [255, 250]
      }
    ],
    startDirection: 0
  },
  // Level 9: Draw houses with for loop.
  '3_9': {
    answer: answer(3, 9),
    initialX: 20,
    initialY: 350,
    ideal: 39,
    toolbox: toolbox(3, 9),
    startBlocks: startBlocks(3, 9),
    requiredBlocks: [
      [simpleBlock('controls_for_counter')],
      [simpleBlock('variables_get_counter')]
    ],
    freePlay: false,
    images: [
      {
        filename: 'cat.svg',
        position: [-10, 270]
      },
      {
        filename: 'cow.svg',
        position: [53, 250]
      },
      {
        filename: 'elephant.svg',
        position: [175, 220]
      }
    ],
    failForTooManyBlocks: true,
    startDirection: 0
  },
  // Level 10: playground.
  '3_10': {
    answer: answer(3, 10),
    freePlay: true,
    toolbox: toolbox(3, 10),
    startBlocks: startBlocks(3, 10)
  },
  // Formerly Page 4.
  // Level 1: One triangle.
  '4_1': {
    answer: answer(4, 1),
    ideal: 3,
    toolbox: toolbox(4, 1),
    startBlocks: startBlocks(4, 1),
    requiredBlocks: [
      [MOVE_FORWARD_OR_BACKWARD_INLINE],
      [repeat(3)],
      [{
        // allow turn right or left, but show turn right block if they've done neither
        test: function(block) {
          return block.type == 'draw_turn_by_constant';
        },
        type: 'draw_turn_by_constant',
        titles: {VALUE: '???'}
      }]
    ],
  },
  // Level 2: Two triangles.
  '4_2': {
    answer: answer(4, 2),
    ideal: 11,
    toolbox: toolbox(4, 2),
    startBlocks: startBlocks(4, 2),
    requiredBlocks: [
      [turnRightByConstant('???')]
    ],
    sliderSpeed: 0.5
  },
  // Level 3: Four triangles using repeat.
  '4_3': {
    answer: answer(4, 3),
    ideal: 7,
    toolbox: toolbox(4, 3),
    startBlocks: startBlocks(4, 3),
    requiredBlocks: [
      [repeat(4)],
      [turnRightByConstant('???')]
    ],
    sliderSpeed: 0.7
  },
  // Level 4: Ten triangles with missing repeat number.
  '4_4': {
    answer: answer(4, 4),
    ideal: 7,
    toolbox: toolbox(4, 4),
    startBlocks: startBlocks(4, 4),
    requiredBlocks: [
      [repeat('???')]
    ],
    sliderSpeed: 0.7,
    impressive: true
  },
  // Level 5: 36 triangles with missing angle number.
  '4_5': {
    answer: answer(4, 5),
    ideal: 7,
    toolbox: toolbox(4, 5),
    startBlocks: startBlocks(4, 5),
    requiredBlocks: [
      [turnRightByConstant('???')]
    ],
    sliderSpeed: 0.9,
    impressive: true
  },
  // Level 6: 1 square.
  '4_6': {
    answer: answer(4, 6),
    ideal: 3,
    toolbox: toolbox(4, 6),
    startBlocks: startBlocks(4, 6),
    requiredBlocks: [
      [moveForwardInline(20)],
      [repeat(4)],
      [{
        test: 'turnRight',
        type: 'draw_turn_by_constant',
        titles: {VALUE: '???'}
      }]
    ],
    permittedErrors: 10,
    startDirection: 0
  },
  // Level 7: Square Ladder.
  '4_7': {
    answer: answer(4, 7),
    initialY: 300,
    ideal: 7,
    toolbox: toolbox(4, 7),
    startBlocks: startBlocks(4, 7),
    requiredBlocks: [
      [moveForwardInline(20)],
      [repeat(10)]
    ],
    startDirection: 0,
    sliderSpeed: 0.7
  },
  // Level 8: Ladder square.
  '4_8': {
    answer: answer(4, 8),
    initialX: 100,
    initialY: 300,
    ideal: 9,
    toolbox: toolbox(4, 8),
    startBlocks: startBlocks(4, 8),
    requiredBlocks: [
      [repeat(4)],
      [turnRightByConstant('???')]
    ],
    startDirection: 0,
    sliderSpeed: 0.9
  },
  // Level 9: Ladder square with a different angle.
  '4_9': {
    answer: answer(4, 9),
    initialX: 150,
    initialY: 350,
    ideal: 9,
    toolbox: toolbox(4, 9),
    startBlocks: startBlocks(4, 9),
    requiredBlocks: [
      [turnRightByConstant('???')]
    ],
    startDirection: 330,
    sliderSpeed: 0.9
  },
  // Level 10: Ladder polygon.
  '4_10': {
    answer: answer(4, 10),
    initialX: 75,
    initialY: 300,
    ideal: 9,
    toolbox: toolbox(4, 10),
    startBlocks: startBlocks(4, 10),
    requiredBlocks: [
      [repeat('???')]
    ],
    startDirection: 0,
    sliderSpeed: 0.9,
    impressive: true
  },
  // Level 11: playground.
  '4_11': {
    answer: answer(4, 11),
    freePlay: true,
    initialX: 75,
    initialY: 300,
    toolbox: toolbox(4, 11),
    startBlocks: startBlocks(4, 11),
    requiredBlocks : [],
    startDirection: 0,
    sliderSpeed: 0.9
   },

  // Formerly Page 5.
  // Level 1: playground.
  '5_1': {
    answer: answer(5, 1),
    freePlay: true,
    toolbox: toolbox(5, 1),
    startBlocks: startBlocks(5, 1),
    sliderSpeed: 0.9
  },
  // Level 2: playground.
  '5_2': {
    answer: answer(5, 2),
    freePlay: true,
    toolbox: toolbox(5, 2),
    startBlocks: startBlocks(5, 2),
    sliderSpeed: 1.0
  },
  // Level 3: playground.
  '5_3': {
    answer: answer(5, 3),
    freePlay: true,
    toolbox: toolbox(5, 3),
    startBlocks: startBlocks(5, 3),
    sliderSpeed: 1.0
  },
  // Level 4: playground.
  '5_4': {
    answer: answer(5, 4),
    freePlay: true,
    toolbox: toolbox(5, 4),
    startBlocks: startBlocks(5, 4),
    sliderSpeed: 1.0
  },
  // Level 5: playground.
  '5_5': {
    answer: answer(5, 5),
    freePlay: true,
    toolbox: toolbox(5, 5),
    startBlocks: startBlocks(5, 5),
    sliderSpeed: 1.0
  },
  // Level 6: playground.
  '5_6': {
    answer: answer(5, 6),
    freePlay: true,
    initialY: 300,
    toolbox: toolbox(5, 6),
    startBlocks: startBlocks(5, 6),
    startDirection: 0,
    sliderSpeed: 1.0
  },
  // The level for building new levels.
  'builder': {
    answer: [],
    freePlay: true,
    initialY: 300,
    toolbox: toolbox(5, 7),
    startBlocks: '',
    startDirection: 0,
    sliderSpeed: 1.0
  },
  // The default level newly created levels use.
  'custom': {
    answer: [],
    freePlay: false,
    initialY: 300,
    toolbox: toolbox(5, 7),
    startBlocks: '',
    startDirection: 0,
    sliderSpeed: 1.0
  },
  'k1_demo': {
    answer: [],
    freePlay: false,
    initialY: 300,
    toolbox: blockUtils.createToolbox(
        blocks.simpleMoveBlocks() +
        blocks.simpleJumpBlocks() +
        blocks.simpleMoveLengthBlocks() +
        blockUtils.blockOfType('controls_repeat_simplified') +
        blockUtils.blockOfType('draw_colour_simple')
      ),
    startBlocks: '',
    startDirection: 0,
    sliderSpeed: 1.0
  }
};

},{"../../locale/af_za/turtle":37,"../block_utils":3,"../level_base":9,"./answers":23,"./core":27,"./requiredBlocks":30,"./startBlocks.xml":31,"./toolbox.xml":32}],29:[function(require,module,exports){
var appMain = require('../appMain');
window.Turtle = require('./turtle');
var blocks = require('./blocks');
var skins = require('../skins');
var levels = require('./levels');

window.turtleMain = function(options) {
  options.skinsModule = skins;
  options.blocksModule = blocks;
  appMain(window.Turtle, levels, options);
};

},{"../appMain":1,"../skins":10,"./blocks":25,"./levels":28,"./turtle":33}],30:[function(require,module,exports){
/**
 * Sets BlocklyApp constants that depend on the page and level.
 * This encapsulates many functions used for BlocklyApps.REQUIRED_BLOCKS.
 * In the future, some of these may be moved to common.js.
 */

// The internal functions are used within BlocklyApps.REQUIRED_BLOCKS.
// I've included jsdoc for some that I think would be good candidates
// for moving to common.js.

/**
 * Create the textual XML for a math_number block.
 * @param {number|string} number The numeric amount, expressed as a
 *     number or string.  Non-numeric strings may also be specified,
 *     such as '???'.
 * @return {string} The textual representation of a math_number block.
 */
var makeMathNumber = function(number) {
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
var simpleBlock = function(block_type) {
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
var repeat = function(count) {
  // This checks for a controls_repeat block rather than looking for 'for',
  // since the latter may be generated by Turtle 2's draw_a_square.
  return {test: function(block) {return block.type == 'controls_repeat';},
          type: 'controls_repeat', titles: {'TIMES': count}};
};

// The remaining internal functions are specific to Turtle.

// This tests for and creates a draw_a_square block on page 2.
function drawASquare(number) {
  return {test: 'draw_a_square',
          type: 'draw_a_square',
          values: {'VALUE': makeMathNumber(number)}};
}

// This tests for and creates a draw_a_snowman block on page 2.
function drawASnowman(number) {
  return {test: 'draw_a_snowman',
          type: 'draw_a_snowman',
          values: {'VALUE': makeMathNumber(number)}};
}

// This tests for and creates the limited "move forward" block used on the
// earlier levels of the tutorial.
var MOVE_FORWARD_INLINE = {test: 'moveForward', type: 'draw_move_by_constant'};

// allow move forward or backward, but show forward block if they've done neither
var MOVE_FORWARD_OR_BACKWARD_INLINE = {
  test: function(block) {
    return block.type == 'draw_move_by_constant';
  },
  type: 'draw_move_by_constant'
};

// This tests for and creates the limited "move forward" block used on the
// earlier levels of the tutorial with the given pixel number.
var moveForwardInline = function(pixels) {
  return {test: 'moveForward',
          type: 'draw_move_by_constant',
          titles: {'VALUE': pixels}};
};

// This tests for and creates the limited "move forward" block used on the
// earlier levels of the tutorial.
var MOVE_BACKWARD_INLINE = {test: 'moveBackward',
                            type: 'draw_move_by_constant',
                            titles: {'DIR': 'moveBackward'}};

// This tests for a [right] draw_turn_by_constant_restricted block
// and creates the block with the specified/recommended number of degrees as
// its input.  The restricted turn is used on the earlier levels of the
// tutorial.
var turnRightRestricted = function(degrees) {
  return {test: 'turnRight(',
          type: 'draw_turn_by_constant_restricted',
          titles: {'VALUE': degrees}};
};

// This tests for and creates a [right] draw_turn_by_constant block
// with the specified number of degrees as its input.
var turnRightByConstant = function(degrees) {
  return {
    test: function(block) {
      return block.type == 'draw_turn_by_constant' &&
          (degrees === '???' ||
           Blockly.JavaScript.valueToCode(
             block, 'VALUE', Blockly.JavaScript.ORDER_NONE) == degrees);
    },
    type: 'draw_turn_by_constant',
    titles: {'VALUE': degrees}};
};

// This tests for and creates a [right] draw_turn block with the specified
// number of degrees as its input.  For the earliest levels, the method
// turnRightRestricted should be used instead.
var turnRight = function(degrees) {
  return {
    test: function(block) {
      return block.type == 'draw_turn' &&
        block.getTitleValue('DIR') == 'turnRight';
      },
    type: 'draw_turn',
    titles: {'DIR': 'turnRight'},
    values: {'VALUE': makeMathNumber(degrees)}
  };
};

// This tests for and creates a left draw_turn block with the specified
// number of degrees as its input.  This method is not appropriate for the
// earliest levels of the tutorial, which do not provide draw_turn.
var turnLeft = function(degrees) {
  return {
    test: function(block) {
      return block.type == 'draw_turn' &&
        block.getTitleValue('DIR') == 'turnLeft';
      },
    type: 'draw_turn',
    titles: {'DIR': 'turnLeft'},
    values: {'VALUE': makeMathNumber(degrees)}
  };
};

// This tests for any draw_move block and, if not present, creates
// one with the specified distance.
var move = function(distance) {
  return {test: function(block) {return block.type == 'draw_move'; },
          type: 'draw_move',
          values: {'VALUE': makeMathNumber(distance)}};
};

// This tests for and creates a draw_turn_by_constant_restricted block.
var drawTurnRestricted = function(degrees) {
  return {
    test: function(block) {
      return block.type == 'draw_turn_by_constant_restricted';
    },
    type: 'draw_turn_by_constant_restricted',
    titles: {'VALUE': degrees}
  };
};

// This tests for and creates a draw_turn block.
var drawTurn = function() {
  return {
    test: function(block) {
      return block.type == 'draw_turn';
    },
    type: 'draw_turn',
    values: {'VALUE': makeMathNumber('???')}
  };
};

// This tests for and creates a "set colour" block with a colour picker
// as its input.
var SET_COLOUR_PICKER = {test: 'penColour(\'#',
  type: 'draw_colour',
  values: {'COLOUR': '<block type="colour_picker"></block>'}};

// This tests for and creates a "set colour" block with a random colour
// generator as its input.
var SET_COLOUR_RANDOM = {test: 'penColour(colour_random',
  type: 'draw_colour',
  values: {'COLOUR': '<block type="colour_random"></block>'}};

/**
 * Creates a required block specification for defining a function with an
 * argument.  Unlike the other functions to create required blocks, this
 * is defined outside of Turtle.setBlocklyAppConstants because it is accessed
 * when checking for a procedure on levels 8-9 of Turtle 3.
 * @param {string} func_name The name of the function.
 * @param {string} arg_name The name of the single argument.
 * @return A required block specification that tests for a call of the
 *     specified function with the specified argument name.  If not present,
 *     this contains the information to create such a block for display.
 */
var defineWithArg = function(func_name, arg_name) {
  return {
    test: function(block) {
      return block.type == 'procedures_defnoreturn' &&
          block.getTitleValue('NAME') == func_name &&
          block.arguments_ && block.arguments_.length &&
          block.arguments_[0] == arg_name;
    },
    type: 'procedures_defnoreturn',
    titles: {'NAME': func_name},
    extra: '<mutation><arg name="' + arg_name + '"></arg></mutation>'
  };
};

module.exports = {
  makeMathNumber: makeMathNumber,
  simpleBlock: simpleBlock,
  repeat: repeat,
  drawASquare: drawASquare,
  drawASnowman: drawASnowman,
  MOVE_FORWARD_INLINE: MOVE_FORWARD_INLINE,
  MOVE_FORWARD_OR_BACKWARD_INLINE: MOVE_FORWARD_OR_BACKWARD_INLINE,
  moveForwardInline: moveForwardInline,
  MOVE_BACKWARD_INLINE: MOVE_BACKWARD_INLINE,
  turnRightRestricted: turnRightRestricted,
  turnRightByConstant: turnRightByConstant,
  turnRight: turnRight,
  turnLeft: turnLeft,
  move: move,
  drawTurnRestricted: drawTurnRestricted,
  drawTurn: drawTurn,
  SET_COLOUR_PICKER: SET_COLOUR_PICKER,
  SET_COLOUR_RANDOM: SET_COLOUR_RANDOM,
  defineWithArg: defineWithArg
};
},{}],31:[function(require,module,exports){
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

var msg = require('../../locale/af_za/turtle');

/**
 * Common code for creating procedures drawing different regular polygons.
 * options:
 *   title Title of procedure.
 *   modifiers String containing any optional keys and values for the initial
 *             <block> tag, such as 'x="20" y="20" editable="false"'.
 *   sides Number of sides.
 *   length 0 if a length parameter should be used, a positive number otherwise
 */
var polygon = function(options) {; buf.push('<block type="procedures_defnoreturn" ', (14,  options.modifiers ), '>\n    <mutation>\n      ');16; if (options.length == 0) {; buf.push('        <arg name="', escape((16,  msg.lengthParameter() )), '"></arg>\n      ');17; }; buf.push('    </mutation>\n    <title name="NAME">', escape((18,  options.title )), '</title>\n    <statement name="STACK">\n      <block type="controls_repeat" ', (20,  options.modifiers ), '>\n        <title name="TIMES">', escape((21,  options.sides )), '</title>\n        <statement name="DO">\n          <block type="draw_move" ', (23,  options.modifiers ), '>\n            <value name="VALUE">\n              ');25; if (options.length == 0) {; buf.push('                <block type="variables_get_length" ', (25,  options.modifiers ), '></block>\n              ');26; } else {; buf.push('                <block type="math_number" ', (26,  options.modifiers ), '>\n                  <title name="NUM">', escape((27,  options.length )), '</title>\n                </block>\n              ');29; }; buf.push('            </value>\n            <next>\n              <block type="draw_turn" ', (31,  options.modifiers ), '>\n                <value name="VALUE">\n                  <block type="math_number" ', (33,  options.modifiers ), '>\n                    <title name="NUM">', escape((34,  360 / options.sides )), '</title>\n                  </block>\n                </value>\n              </block>\n            </next>\n          </block>\n        </statement>\n      </block>\n    </statement>\n  </block>\n');44; };; buf.push('\n');45;
/**
 * Spiral needs a named helper template for recursion.
 * @param i Loop control variable.
 */
var spiral = function(i) {; buf.push('  ');50; if (i <= 60) {; buf.push('    <block type="draw_move" ');50; if (i == 25) { ; buf.push('x="300" y="100"');50; } ; buf.push(' inline="false" editable="false" deletable="false" disabled="true">\n      <title name="DIR">moveForward</title>\n      <value name="VALUE">\n        <block type="math_number" editable="false" deletable="false" disabled="true">\n          <title name="NUM">', escape((54,  i )), '</title>\n        </block>\n      </value>\n      <next>\n        <block type="draw_turn" inline="false" editable="false" deletable="false" disabled="true">\n          <title name="DIR">turnRight</title>\n          <value name="VALUE">\n            <block type="math_number" editable="false" deletable="false" disabled="true">\n              <title name="NUM">90</title>\n            </block>\n          </value>\n          <next>\n            ');66; spiral(i + 5); buf.push('          </next>\n        </block>\n      </next>\n    </block>\n  ');70; } ; buf.push('\n');71; };; buf.push('\n');72;
/**
 * Define the starting blocks for each page and level.
 * These are referenced from turtle.js.
 */
; buf.push('\n');78; if (page == 1) {; buf.push('  ');78; if (level == 1) {; buf.push('    <block type="draw_move_by_constant" x="20" y="20"></block>\n  ');79; } else if (level == 2) {; buf.push('    <block type="draw_colour" inline="true" x="20" y="20">\n      <value name="COLOUR">\n        <block type="colour_picker">\n          <title name="COLOUR">#ff0000</title>\n        </block>\n      </value>\n      <next>\n        <block type="draw_move_by_constant"></block>\n      </next>\n    </block>\n  ');89; } else if (level == 4) {; buf.push('    <block type="controls_repeat" x="20" y="20">\n      <title name="TIMES">3</title>\n      <statement name="DO">\n        <block type="draw_colour" inline="true">\n          <value name="COLOUR">\n            <block type="colour_random"></block>\n          </value>\n        </block>\n      </statement>\n    </block>\n  ');99; } else if (level == 3 || level == 5 || level == 6) {; buf.push('    <block type="controls_repeat" x="20" y="20">\n      <title name="TIMES">');100; if (level == 3) { ; buf.push('4');100; } else { ; buf.push('3');100; } ; buf.push('</title>\n    </block>\n  ');102; } else if (level == 7) {; buf.push('    <block type="draw_turn_by_constant_restricted" x="20" y="20">\n      <title name="DIR">turnRight</title>\n      <title name="VALUE">90</title>\n    </block>\n  ');106; } else if (level == 8) {; buf.push('    <block id="set-color" type="draw_colour" x="20" y="100">\n      <value name="COLOUR">\n        <block type="colour_random"></block>\n      </value>\n      <next>\n        <block type="draw_move_by_constant">\n          <title name="DIR">moveForward</title>\n          <title name="VALUE">100</title>\n          <next>\n            <block type="draw_move_by_constant">\n              <title name="DIR">moveBackward</title>\n              <title name="VALUE">100</title>\n              <next>\n                <block type="draw_turn_by_constant">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">45</title>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </next>\n    </block>\n  ');129; } else if (level == 9) {; buf.push('    <block type="controls_repeat" deletable="false" movable="false" x="20" y="20">\n      <title name="TIMES">??</title>\n      <statement name="DO">\n        <block type="draw_move" editable="false" deletable="false" movable="false">\n          <value name="VALUE">\n            <block type="math_number" editable="false" deletable="false" movable="false">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n          <next>\n            <block type="draw_turn" editable="false" deletable="false" movable="false">\n              <value name="VALUE">\n                <block type="math_number" editable="false" deletable="false" movable="false">\n                  <title name="NUM">1</title>\n                </block>\n              </value>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');150; } else if (level == 10) {; buf.push('    <block type="draw_move_by_constant" x="20" y="20">\n      <title name="DIR">moveForward</title>\n      <title name="VALUE">100</title>\n    </block>\n  ');154; }; buf.push('');154; } else if (page == 2) {; buf.push('  ');154; // No blocks are provided for levels 1 and 2.
; buf.push('  ');154; if (level == 3 || level == 5) {; buf.push('    ');154; // Call "draw a square".
; buf.push('    <block type="draw_a_square" inline="true" x="20" y="20">\n      <value name="VALUE">\n        <block type="math_number">\n          <title name="NUM">');157; if (level == 3) { ; buf.push('100');157; } else { ; buf.push('50');157; } ; buf.push('</title>\n        </block>\n      </value>\n    </block>\n  ');161; } else if (level == 4) {; buf.push('    ');161; // Three-square code.
; buf.push('    <block type="controls_repeat" deletable="false" movable="false" x="20" y="20">\n      <title name="TIMES">???</title>\n      <statement name="DO">\n        <block id="set-color" type="draw_colour" deletable="false" movable="false">\n          <value name="COLOUR">\n            <block type="colour_random" deletable="false" movable="false">\n            </block>\n          </value>\n          <next>\n            <block type="draw_a_square" inline="true" editable="false" deletable="false" movable="false">\n              <value name="VALUE">\n                <block type="math_number" deletable="false" movable="false">\n                  <title name="NUM">???</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" editable="false" deletable="false" movable="false">\n                  <value name="VALUE">\n                    <block type="math_number" deletable="false" movable="false">\n                      <title name="NUM">???</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');190; } else if (level == 6) {; buf.push('    <block type="controls_for_counter" inline="true" x="20" y="20">\n    <title name="VAR">', escape((191,  msg.loopVariable() )), '</title>\n      <value name="FROM">\n        <block type="math_number">\n          <title name="NUM">');194; if (level == 6) { ; buf.push('50');194; } else { ; buf.push('10');194; } ; buf.push('</title>\n        </block>\n      </value>\n      <value name="TO">\n        <block type="math_number">\n          <title name="NUM">');199; if (level == 6) { ; buf.push('90');199; } else { ; buf.push('100');199; } ; buf.push('</title>\n        </block>\n      </value>\n      <value name="BY">\n        <block type="math_number">\n          <title name="NUM">10</title>\n        </block>\n      </value>\n      <statement name="DO">\n        <block type="draw_a_square" inline="true">\n        </block>\n      </statement>\n    </block>\n  ');212; } else if (level == 7) {; buf.push('    ');212; spiral(25); buf.push('  ');212; } else if (level == 7.5) {; buf.push('    <block type="draw_a_snowman" x="20" y="20" inline="true">\n      <value name="VALUE">\n        <block type="math_number">\n          <title name="NUM">250</title>\n        </block>\n      </value>\n    </block>\n  ');219; } else if (level == 8 || level == 9) {; buf.push('    <block type="draw_a_snowman" x="20" y="20" inline="true">\n      <value name="VALUE">\n        <block type="math_number">\n          <title name="NUM">150</title>\n        </block>\n      </value>\n    </block>\n  ');226; } else if (level == 10) {; buf.push('    <block id="draw-width" type="draw_width" inline="false" x="158" y="67">\n      <value name="WIDTH">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <next>\n        <block type="controls_for_counter" inline="true">\n          <value name="FROM">\n            <block type="math_number">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n          <value name="TO">\n            <block type="math_number">\n              <title name="NUM">100</title>\n            </block>\n          </value>\n          <value name="BY">\n            <block type="math_number">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n          <statement name="DO">\n            <block type="draw_move" inline="false">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get_counter"></block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="false">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">91</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </next>\n    </block>\n  ');270; }; buf.push('');270; } else if (page == 3) {; buf.push('  ');270; // Define "draw a square".
; buf.push('  ', (270,  polygon({
    title: msg.drawASquare(),
    modifiers: ' x="20" y="20" editable="false" deletable="false" movable="false"',
    sides: 4,
    length: (level >= 6 ? 0 : 100)
  })), '  ');275; if (level == 1) {; buf.push('    ');275; // Define "draw a circle".
; buf.push('    ', (275,  polygon({
      title: msg.drawACircle(),
      modifiers: 'x="370" y="20" editable="false" deletable="false" movable="false"',
      sides: 360,
      length: 1
    })), '  ');280; }; buf.push('  ');280; if (level == 2) {; buf.push('    <block type="procedures_defnoreturn" x="20" y="175">\n      <title name="NAME">', escape((281,  msg.drawATriangle() )), '</title>\n    </block>\n  ');283; } else if (level >= 3) {; buf.push('    ');283; //  Define "draw a triangle".
; buf.push('    ', (283,  polygon({
      title: msg.drawATriangle(),
      modifiers: (level == 6 ? 'x="20" y="190"' : 'x="390" y="20" editable="false" deletable="false" movable="false"'),
      sides: 3,
      length: (level >= 7 ? 0 : 100)
    })), '  ');288; }; buf.push('  ');288; if (level == 7) {; buf.push('    ');288; //  Define "draw a house".
; buf.push('    <block type="procedures_defnoreturn" x="20" y="200">\n      <mutation>\n        ');290; if (level == 11) { ; buf.push('<arg name="', escape((290,  msg.lengthParameter() )), '"></arg>');290; }; buf.push('      </mutation>\n      <title name="NAME">', escape((291,  msg.drawAHouse() )), '</title>\n      <statement name="STACK">\n        <block type="procedures_callnoreturn" inline="false">\n          <mutation name="', escape((294,  msg.drawASquare() )), '">\n            <arg name="', escape((295,  msg.lengthParameter() )), '"/>\n          </mutation>\n          <value name="ARG0">\n            <block type="math_number">\n              <title name="NUM">100</title>\n            </block>\n          </value>\n          <next>\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="math_number">\n                  <title name="NUM">100</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">30</title>\n                    </block>\n                  </value>\n                  <next>\n                    <block type="procedures_callnoreturn" inline="false">\n                      <mutation name="', escape((320,  msg.drawATriangle() )), '">\n                        <arg name="', escape((321,  msg.lengthParameter() )), '"></arg>\n                      </mutation>\n                      <value name="ARG0">\n                        <block type="math_number">\n                          <title name="NUM">100</title>\n                        </block>\n                      </value>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');337; } // End of region in which "draw a square" is defined.
; buf.push('');337; } else if (page == 4) {; buf.push('  ');337; if (level == 2) {; buf.push('    <block type="draw_colour" inline="true" x="70" y="70" editable="false" deletable="false" movable="false">\n      <value name="COLOUR">\n        <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n      </value>\n      <next>\n        <block type="controls_repeat" editable="false" deletable="false" movable="false">\n          <title name="TIMES">3</title>\n          <statement name="DO">\n            <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n              <title name="DIR">moveForward</title>\n              <title name="VALUE">100</title>\n              <next>\n                <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">120</title>\n                </block>\n              </next>\n            </block>\n          </statement>\n          <next>\n            <block type="draw_colour" inline="true" x="70" y="230" editable="false" deletable="false" movable="false">\n              <value name="COLOUR">\n                <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n              </value>\n              <next>\n                <block type="controls_repeat" editable="false" deletable="false" movable="false">\n                  <title name="TIMES">3</title>\n                  <statement name="DO">\n                    <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">100</title>\n                      <next>\n                        <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                          <title name="DIR">turnRight</title>\n                          <title name="VALUE">120</title>\n                        </block>\n                      </next>\n                    </block>\n                  </statement>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </next>\n    </block>\n  ');383; } else if (level == 3) {; buf.push('    <block type="draw_colour" inline="true" x="70" y="70" editable="false" deletable="false" movable="false">\n      <value name="COLOUR">\n        <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n      </value>\n      <next>\n        <block type="controls_repeat" editable="false" deletable="false" movable="false">\n          <title name="TIMES">3</title>\n          <statement name="DO">\n            <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n              <title name="DIR">moveForward</title>\n              <title name="VALUE">100</title>\n              <next>\n                <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">120</title>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </next>\n    </block>\n  ');405; } else if (level == 4) {; buf.push('    <block type="controls_repeat" x="70" y="70">\n      <title name="TIMES">???</title>\n      <statement name="DO">\n        <block type="draw_colour" inline="true" editable="false" deletable="false" movable="false">\n          <value name="COLOUR">\n            <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n          </value>\n          <next>\n            <block type="controls_repeat" editable="false" deletable="false" movable="false">\n              <title name="TIMES">3</title>\n              <statement name="DO">\n                <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">moveForward</title>\n                  <title name="VALUE">100</title>\n                  <next>\n                    <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">turnRight</title>\n                      <title name="VALUE">120</title>\n                    </block>\n                  </next>\n                </block>\n              </statement>\n              <next>\n                <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">36</title>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');438; } else if (level == 5) {; buf.push('    <block type="controls_repeat" x="70" y="70" editable="false" deletable="false" movable="false">\n      <title name="TIMES">36</title>\n      <statement name="DO">\n        <block type="draw_colour" inline="true" editable="false" deletable="false" movable="false">\n          <value name="COLOUR">\n            <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n          </value>\n          <next>\n            <block type="controls_repeat" editable="false" deletable="false" movable="false">\n              <title name="TIMES">3</title>\n              <statement name="DO">\n                <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">moveForward</title>\n                  <title name="VALUE">100</title>\n                  <next>\n                    <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">turnRight</title>\n                      <title name="VALUE">120</title>\n                    </block>\n                  </next>\n                </block>\n              </statement>\n              <next>\n                <block type="draw_turn_by_constant">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">???</title>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');471; } else if (level == 7) {; buf.push('    <block type="draw_colour" inline="true" x="70" y="70" editable="false" deletable="false" movable="false">\n      <value name="COLOUR">\n        <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n      </value>\n      <next>\n        <block type="controls_repeat" editable="false" deletable="false" movable="false">\n          <title name="TIMES">4</title>\n          <statement name="DO">\n            <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n              <title name="DIR">moveForward</title>\n              <title name="VALUE">20</title>\n              <next>\n                <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">turnRight</title>\n                  <title name="VALUE">90</title>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </next>\n    </block>\n  ');493; } else if (level == 8) {; buf.push('    <block type="controls_repeat" x="70" y="70" editable="false" deletable="false" movable="false">\n      <title name="TIMES">10</title>\n      <statement name="DO">\n        <block type="draw_colour" inline="true" editable="false" deletable="false" movable="false">\n          <value name="COLOUR">\n            <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n          </value>\n          <next>\n            <block type="controls_repeat" editable="false" deletable="false" movable="false">\n              <title name="TIMES">4</title>\n              <statement name="DO">\n                <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">moveForward</title>\n                  <title name="VALUE">20</title>\n                  <next>\n                    <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">turnRight</title>\n                      <title name="VALUE">90</title>\n                    </block>\n                  </next>\n                </block>\n              </statement>\n              <next>\n                <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                  <title name="DIR">moveForward</title>\n                  <title name="VALUE">20</title>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');526; } else if (level == 9) {; buf.push('    <block type="controls_repeat" x="70" y="70" editable="false" deletable="false" movable="false">\n      <title name="TIMES">4</title>\n      <statement name="DO">\n        <block type="controls_repeat" editable="false" deletable="false" movable="false">\n          <title name="TIMES">10</title>\n          <statement name="DO">\n            <block type="draw_colour" inline="true" editable="false" deletable="false" movable="false">\n              <value name="COLOUR">\n                <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n              </value>\n              <next>\n                <block type="controls_repeat" editable="false" deletable="false" movable="false">\n                  <title name="TIMES">4</title>\n                  <statement name="DO">\n                    <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                      <next>\n                        <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                          <title name="DIR">turnRight</title>\n                          <title name="VALUE">90</title>\n                        </block>\n                      </next>\n                    </block>\n                  </statement>\n                  <next>\n                    <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </statement>\n          <next>\n            <block type="draw_turn_by_constant">\n              <title name="DIR">turnRight</title>\n              <title name="VALUE">???</title>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');570; } else if (level == 10) {; buf.push('    <block type="controls_repeat" x="70" y="70">\n      <title name="TIMES">???</title>\n      <statement name="DO">\n        <block type="controls_repeat" editable="false" deletable="false" movable="false">\n          <title name="TIMES">10</title>\n          <statement name="DO">\n            <block type="draw_colour" inline="true" editable="false" deletable="false" movable="false">\n              <value name="COLOUR">\n                <block type="colour_random" editable="false" deletable="false" movable="false"></block>\n              </value>\n              <next>\n                <block type="controls_repeat" editable="false" deletable="false" movable="false">\n                  <title name="TIMES">4</title>\n                  <statement name="DO">\n                    <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                      <next>\n                        <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n                          <title name="DIR">turnRight</title>\n                          <title name="VALUE">90</title>\n                        </block>\n                      </next>\n                    </block>\n                  </statement>\n                  <next>\n                    <block type="draw_move_by_constant" editable="false" deletable="false" movable="false">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </statement>\n          <next>\n            <block type="draw_turn_by_constant" editable="false" deletable="false" movable="false">\n              <title name="DIR">turnRight</title>\n              <title name="VALUE">80</title>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');614; } else if (level == 11) {; buf.push('    <block type="controls_repeat" x="70" y="70">\n      <title name="TIMES">???</title>\n      <statement name="DO">\n        <block type="controls_repeat">\n          <title name="TIMES">10</title>\n          <statement name="DO">\n            <block type="draw_colour" inline="true">\n              <value name="COLOUR">\n                <block type="colour_random"></block>\n              </value>\n              <next>\n                <block type="controls_repeat">\n                  <title name="TIMES">4</title>\n                  <statement name="DO">\n                    <block type="draw_move_by_constant">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                      <next>\n                        <block type="draw_turn_by_constant">\n                          <title name="DIR">turnRight</title>\n                          <title name="VALUE">90</title>\n                        </block>\n                      </next>\n                    </block>\n                  </statement>\n                  <next>\n                    <block type="draw_move_by_constant">\n                      <title name="DIR">moveForward</title>\n                      <title name="VALUE">20</title>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </statement>\n          <next>\n            <block type="draw_turn_by_constant">\n              <title name="DIR">turnRight</title>\n              <title name="VALUE">???</title>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');658; }; buf.push('');658; } else if (page == 5) {; buf.push('  ');658; if (level == 1) {; buf.push('    <block type="controls_for_counter" inline="true" x="70" y="70">\n      <value name="FROM">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <value name="TO">\n        <block type="math_number">\n          <title name="NUM">200</title>\n        </block>\n      </value>\n      <value name="BY">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <statement name="DO">\n        <block type="draw_colour" inline="true">\n          <value name="COLOUR">\n            <block type="colour_random"></block>\n          </value>\n          <next>\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get">\n                  <title name="VAR">counter</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">90</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');702; } else if (level == 2) {; buf.push('    <block type="controls_for_counter" inline="true" x="70" y="70">\n      <value name="FROM">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <value name="TO">\n        <block type="math_number">\n          <title name="NUM">300</title>\n        </block>\n      </value>\n      <value name="BY">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <statement name="DO">\n        <block type="draw_colour" inline="true">\n          <value name="COLOUR">\n            <block type="colour_random"></block>\n          </value>\n          <next>\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get">\n                  <title name="VAR">counter</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">121</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');746; } else if (level == 3) {; buf.push('    <block type="controls_for_counter" inline="true" x="70" y="70">\n      <value name="FROM">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <value name="TO">\n        <block type="math_number">\n          <title name="NUM">300</title>\n        </block>\n      </value>\n      <value name="BY">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n      <statement name="DO">\n        <block type="draw_colour" inline="true">\n          <value name="COLOUR">\n            <block type="colour_random"></block>\n          </value>\n          <next>\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get">\n                  <title name="VAR">counter</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">134</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n  ');790; } else if (level == 4) {; buf.push('    <block type="controls_repeat" x="70" y="20">\n      <title name="TIMES">10</title>\n      <statement name="DO">\n        <block type="draw_colour" inline="true">\n          <value name="COLOUR">\n            <block type="colour_random"></block>\n          </value>\n          <next>\n            <block type="procedures_callnoreturn" inline="false">\n              <mutation name="', escape((799,  msg.drawACircle() )), '">\n                <arg name="step"></arg>\n              </mutation>\n              <value name="ARG0">\n                <block type="math_number">\n                  <title name="NUM">6</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">36</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </next>\n        </block>\n      </statement>\n    </block>\n    <block type="procedures_defnoreturn" x="70" y="200">\n      <mutation>\n        <arg name="step"></arg>\n      </mutation>\n      <title name="NAME">', escape((826,  msg.drawACircle() )), '</title>\n      <statement name="STACK">\n        <block type="controls_repeat">\n          <title name="TIMES">60</title>\n          <statement name="DO">\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get">\n                  <title name="VAR">step</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">6</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </statement>\n    </block>\n  ');853; } else if (level == 5) {; buf.push('    <block type="controls_for_counter" inline="true" x="70" y="20">\n      <value name="FROM">\n        <block type="math_number">\n          <title name="NUM">4</title>\n        </block>\n      </value>\n      <value name="TO">\n        <block type="math_number">\n          <title name="NUM">8</title>\n        </block>\n      </value>\n      <value name="BY">\n        <block type="math_number">\n          <title name="NUM">4</title>\n        </block>\n      </value>\n      <statement name="DO">\n        <block type="controls_repeat">\n          <title name="TIMES">10</title>\n          <statement name="DO">\n            <block type="draw_colour" inline="true">\n              <value name="COLOUR">\n                <block type="colour_random"></block>\n              </value>\n              <next>\n                <block type="procedures_callnoreturn" inline="false">\n                  <mutation name="', escape((879,  msg.drawACircle() )), '">\n                    <arg name="step"></arg>\n                  </mutation>\n                  <value name="ARG0">\n                    <block type="variables_get">\n                      <title name="VAR">counter</title>\n                    </block>\n                  </value>\n                  <next>\n                    <block type="draw_turn" inline="true">\n                      <title name="DIR">turnRight</title>\n                      <value name="VALUE">\n                        <block type="math_number">\n                          <title name="NUM">36</title>\n                        </block>\n                      </value>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </statement>\n    </block>\n    <block type="procedures_defnoreturn" x="70" y="300">\n      <mutation>\n        <arg name="step"></arg>\n      </mutation>\n      <title name="NAME">', escape((908,  msg.drawACircle() )), '</title>\n      <statement name="STACK">\n        <block type="controls_repeat">\n          <title name="TIMES">60</title>\n          <statement name="DO">\n            <block type="draw_move" inline="true">\n              <title name="DIR">moveForward</title>\n              <value name="VALUE">\n                <block type="variables_get">\n                  <title name="VAR">step</title>\n                </block>\n              </value>\n              <next>\n                <block type="draw_turn" inline="true">\n                  <title name="DIR">turnRight</title>\n                  <value name="VALUE">\n                    <block type="math_number">\n                      <title name="NUM">6</title>\n                    </block>\n                  </value>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </statement>\n    </block>\n  ');935; } else if (level == 6) {; buf.push('    <block type="procedures_callnoreturn" inline="false" x="70" y="20">\n      <mutation name="', escape((936,  msg.drawATree() )), '">\n        <arg name="depth"></arg>\n        <arg name="branches"></arg>\n      </mutation>\n      <value name="ARG0">\n        <block type="math_number">\n          <title name="NUM">9</title>\n        </block>\n      </value>\n      <value name="ARG1">\n        <block type="math_number">\n          <title name="NUM">2</title>\n        </block>\n      </value>\n    </block>\n    <block type="procedures_defnoreturn" x="70" y="150">\n      <mutation>\n        <arg name="depth"></arg>\n        <arg name="branches"></arg>\n      </mutation>\n      <title name="NAME">', escape((956,  msg.drawATree() )), '</title>\n      <statement name="STACK">\n        <block type="controls_if" inline="false">\n          <value name="IF0">\n            <block type="logic_compare" inline="true">\n              <title name="OP">GT</title>\n              <value name="A">\n                <block type="variables_get">\n                  <title name="VAR">depth</title>\n                </block>\n              </value>\n              <value name="B">\n                <block type="math_number">\n                  <title name="NUM">0</title>\n                </block>\n              </value>\n            </block>\n          </value>\n          <statement name="DO0">\n            <block type="draw_colour" inline="true">\n              <value name="COLOUR">\n                <block type="colour_random"></block>\n              </value>\n              <next>\n                <block type="draw_pen">\n                  <title name="PEN">penDown</title>\n                  <next>\n                    <block type="draw_move" inline="true">\n                      <title name="DIR">moveForward</title>\n                      <value name="VALUE">\n                        <block type="math_arithmetic" inline="true">\n                          <title name="OP">MULTIPLY</title>\n                          <value name="A">\n                            <block type="math_number">\n                              <title name="NUM">7</title>\n                            </block>\n                          </value>\n                          <value name="B">\n                            <block type="variables_get">\n                              <title name="VAR">depth</title>\n                            </block>\n                          </value>\n                        </block>\n                      </value>\n                      <next>\n                        <block type="draw_turn" inline="true">\n                          <title name="DIR">turnLeft</title>\n                          <value name="VALUE">\n                            <block type="math_number">\n                              <title name="NUM">130</title>\n                            </block>\n                          </value>\n                          <next>\n                            <block type="controls_repeat_ext" inline="true">\n                              <value name="TIMES">\n                                <block type="variables_get">\n                                  <title name="VAR">branches</title>\n                                </block>\n                              </value>\n                              <statement name="DO">\n                                <block type="draw_turn" inline="true">\n                                  <title name="DIR">turnRight</title>\n                                  <value name="VALUE">\n                                    <block type="math_arithmetic" inline="true">\n                                      <title name="OP">DIVIDE</title>\n                                      <value name="A">\n                                        <block type="math_number">\n                                          <title name="NUM">180</title>\n                                        </block>\n                                      </value>\n                                      <value name="B">\n                                        <block type="variables_get">\n                                          <title name="VAR">branches</title>\n                                        </block>\n                                      </value>\n                                    </block>\n                                  </value>\n                                  <next>\n                                    <block type="procedures_callnoreturn" inline="false">\n                                      <mutation name="', escape((1035,  msg.drawATree() )), '">\n                                        <arg name="depth"></arg>\n                                        <arg name="branches"></arg>\n                                      </mutation>\n                                      <value name="ARG0">\n                                        <block type="math_arithmetic" inline="true">\n                                          <title name="OP">MINUS</title>\n                                          <value name="A">\n                                            <block type="variables_get">\n                                              <title name="VAR">depth</title>\n                                            </block>\n                                          </value>\n                                          <value name="B">\n                                            <block type="math_number">\n                                              <title name="NUM">1</title>\n                                            </block>\n                                          </value>\n                                        </block>\n                                      </value>\n                                      <value name="ARG1">\n                                        <block type="variables_get">\n                                          <title name="VAR">branches</title>\n                                        </block>\n                                      </value>\n                                    </block>\n                                  </next>\n                                </block>\n                              </statement>\n                              <next>\n                                <block type="draw_turn" inline="true">\n                                  <title name="DIR">turnLeft</title>\n                                  <value name="VALUE">\n                                    <block type="math_number">\n                                      <title name="NUM">50</title>\n                                    </block>\n                                  </value>\n                                  <next>\n                                    <block type="draw_pen">\n                                      <title name="PEN">penUp</title>\n                                      <next>\n                                        <block type="draw_move" inline="true">\n                                          <title name="DIR">moveBackward</title>\n                                          <value name="VALUE">\n                                            <block type="math_arithmetic" inline="true">\n                                              <title name="OP">MULTIPLY</title>\n                                              <value name="A">\n                                                <block type="math_number">\n                                                  <title name="NUM">7</title>\n                                                </block>\n                                              </value>\n                                              <value name="B">\n                                                <block type="variables_get">\n                                                  <title name="VAR">depth</title>\n                                                </block>\n                                              </value>\n                                            </block>\n                                          </value>\n                                        </block>\n                                      </next>\n                                    </block>\n                                  </next>\n                                </block>\n                              </next>\n                            </block>\n                          </next>\n                        </block>\n                      </next>\n                    </block>\n                  </next>\n                </block>\n              </next>\n            </block>\n          </statement>\n        </block>\n      </statement>\n    </block>\n  ');1111; }; buf.push('');1111; }; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/turtle":37,"ejs":38}],32:[function(require,module,exports){
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

var msg = require('../../locale/af_za/turtle');

/*
TOOLBOX.

PAGE 1
======
Within this page, blocks are only added, never taken away.

Level 1 [el]: Adds draw_move_by_constant and draw_turn_by_constant.
Level 2 [coloured square]: Adds draw_colour with colour_picker.
level 3 [square in three blocks]: Adds controls_repeat.
level 4 [triangle] Adds draw_colour with colour_random.
Level 5 [overlapping square and triangle (sideways envelope)]
Level 6 [envelope]
Level 7 [glasses]
Level 8 [spikes]
Level 9 [circle]
Level 10 [free play]: draw_width

PAGE 2
======
Categories are introduced, with contents of:
- Actions
  - draw_move with math_number
  - draw_turn with math_number
- Color
  - draw_colour (set colour) with colour_picker
  - draw_colour (set colour) with colour_random
- Functions (added at level 2)
  - [call] draw a square
  - [call] draw a snowball (added at level 9)
- Loops
  - controls_repeat
  - controls_for (added at level 6)
- Math
  - math_number
- Variables (added at level 6)
  - get counter (added at level 9)
  - get height (added at level 7)
  - get length (levels 6 and 10)
Level 1 [square]
Level 2 [square by function call]: add "draw a square"
Level 3 [3 squares]
Level 4 [36 squares]
Level 5 [nested squares without controls_for]
Level 6 [nested squares with controls_for]
Level 7 [mini-spiral]
Level 8 [3 snowmen]: add "draw a snowman"
Level 9 [snowman family]
Level 10 [free play]

PAGE 3
======
Categories are used, with contents of:
- Actions
  - draw_move with math_number
  - draw_turn with math_number
- Color
  - draw_colour (set colour) with colour_picker
  - draw_colour (set colour) with colour_random
- Functions (Replaced with custom category at level 2)
  - [call] draw a circle
  - [call] draw a square
- Loops
  - controls_for
  - controls_repeat
- Math
  - math_number
- Variables (added at level 6)
  - get counter
Variables and functions are manually added until Levels 7 and 8,
when the custom categories are used
Level 1 [call "draw a square"]
Level 2 [create and call "draw a triangle"]
Level 3 [use "draw a square" and "draw a triangle" to fence animals]
Level 4 [draw a house]
Level 5 [create and call "draw a house"]
Level 6 [add parameter to "draw a triangle"]
Level 7 [add parameter to "draw a house"]
Level 8 [modify end location of "create a house"]
Level 9 [call "draw a house" with for loop]
Level 10 [free play]

*/; buf.push('<xml id="toolbox" style="display: none;">\n  ');88; if (page == 1) {; buf.push('    <block type="draw_move_by_constant"></block>\n    <block type="draw_turn_by_constant');89; if (level <= 8) { ; buf.push('_restricted');89; } ; buf.push('">\n      <title name="VALUE">90</title>\n    </block>\n    ');92; if (level >= 2) {; buf.push('      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_picker"></block>\n        </value>\n      </block>\n    ');97; }; buf.push('    ');97; if (level >= 4) { /* Out of numeric order to make colour blocks adjacent. */; buf.push('      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_random"></block>\n        </value>\n      </block>\n    ');102; }; buf.push('    ');102; if (level >= 3) {; buf.push('      <block type="controls_repeat">\n        <title name="TIMES">4</title>\n      </block>\n    ');105; }; buf.push('    ');105; if (level == 10) {; buf.push('      <block id="draw-width" type="draw_width" inline="false" x="158" y="67">\n        <value name="WIDTH">\n          <block type="math_number">\n            <title name="NUM">1</title>\n          </block>\n        </value>\n      </block>\n    ');112; }; buf.push('  ');112; } else if (page == 2 || page == 3) {; buf.push('    ');112; // Actions: draw_move, draw_turn.
; buf.push('    <category id="actions" name="', escape((112,  msg.catTurtle() )), '">\n      <block type="draw_move">\n        <value name="VALUE">\n          <block type="math_number">\n            <title name="NUM">100</title>\n          </block>\n        </value>\n      </block>\n      ');120; if (page == 2 && level >= 8) {; buf.push('        <block type="jump">\n          <value name="VALUE">\n            <block type="math_number">\n              <title name="NUM">50</title>\n            </block>\n          </value>\n        </block>\n      ');127; }; buf.push('      <block type="draw_turn">\n        <value name="VALUE">\n          <block type="math_number">\n            <title name="NUM">90</title>\n          </block>\n        </value>\n      </block>\n      ');134; if (level == 10) {; buf.push('        <block id="draw-width" type="draw_width">\n          <value name="WIDTH">\n            <block type="math_number">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n        </block>\n      ');141; }; buf.push('    </category>\n    ');142; // Colour: draw_colour with colour_picker and colour_random.
; buf.push('    <category name="', escape((142,  msg.catColour() )), '">\n      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_picker"></block>\n        </value>\n      </block>\n      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_random"></block>\n        </value>\n      </block>\n    </category>\n    ');154; // Functions differ depending on page and level.
; buf.push('    ');154; if (page == 2 && level >= 2) {; buf.push('      <category name="', escape((154,  msg.catProcedures() )), '">\n        <block type="draw_a_square" inline="true">\n          <value name="VALUE">\n            <block type="math_number">\n              <title name="NUM">100</title>\n            </block>\n          </value>\n        </block>\n        ');162; if (level >= 8) {; buf.push('          <block type="draw_a_snowman" inline="true">\n            <value name="VALUE">\n              <block type="math_number">\n                <title name="NUM">100</title>\n              </block>\n            </value>\n          </block>\n        ');169; }; buf.push('      </category>\n    ');170; } else if (page == 3) {; buf.push('      ');170; if (level == 1) {; buf.push('        ');170; // Don't use custom category yet, since it allows function definition.
; buf.push('        <category name="', escape((170,  msg.catProcedures() )), '">\n          <block type="procedures_callnoreturn">\n            <mutation name="', escape((172,  msg.drawACircle() )), '"></mutation>\n          </block>\n          <block type="procedures_callnoreturn">\n            <mutation name="', escape((175,  msg.drawASquare() )), '"></mutation>\n          </block>\n        </category>\n      ');178; } else { ; buf.push('\n        <category name="', escape((179,  msg.catProcedures() )), '" custom="PROCEDURE"></category>\n      ');180; }; buf.push('    ');180; }; buf.push('    ');180; // Control: controls_for_counter (from page 2, level 6) and repeat.
; buf.push('    <category name="', escape((180,  msg.catControl() )), '">\n      ');181; if ((page == 2 && level >= 6) || (page == 3 && level >= 9)) {; buf.push('        <block type="controls_for_counter">\n          <value name="FROM">\n            <block type="math_number">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n          <value name="TO">\n            <block type="math_number">\n              <title name="NUM">100</title>\n            </block>\n          </value>\n          <value name="BY">\n            <block type="math_number">\n              <title name="NUM">10</title>\n            </block>\n          </value>\n        </block>\n      ');198; }; buf.push('      <block type="controls_repeat">\n        <title name="TIMES">4</title>\n      </block>\n    </category>\n    ');202; // Math: Just number blocks until final level.
; buf.push('    <category name="', escape((202,  msg.catMath() )), '">\n      <block type="math_number"></block>\n      ');204; if (level == 10) {; buf.push('        <block type="math_arithmetic" inline="true"></block>\n        <block type="math_random_int">\n          <value name="FROM">\n            <block type="math_number">\n              <title name="NUM">1</title>\n            </block>\n          </value>\n          <value name="TO">\n            <block type="math_number">\n              <title name="NUM">100</title>\n            </block>\n        </value>\n      </block>\n      <block type="math_random_float"></block>\n    ');218; }; buf.push('    </category>\n    ');219; // Variables depends on page and level, although we never use the custom category
; buf.push('    ');219; // because we want to offer simplified getters and no setters.
; buf.push('    ');219; if (page == 2 && level >= 6) {; buf.push('      <category name="', escape((219,  msg.catVariables() )), '">\n        <block type="variables_get_counter"></block>\n      </category>\n    ');222; } else if (page == 3 && level >= 6 && level < 10) {; buf.push('      <category name="', escape((222,  msg.catVariables() )), '">\n        ');223; if (level >= 9) {; buf.push('          <block type="variables_get_counter"></block>\n        ');224; }; buf.push('        ');224; if (level >= 6) {; buf.push('          <block type="variables_get_length"></block>\n        ');225; }; buf.push('      </category>\n    ');226; } else if (page == 3 && level == 10) {; buf.push('      <category name="', escape((226,  msg.catVariables() )), '" custom="VARIABLE">\n      </category>\n    ');228; }; buf.push('  ');228; } else if (page == 4) {; buf.push('    ');228; // Actions: draw_move, draw_turn.
; buf.push('    <block type="draw_move_by_constant"></block>\n    <block type="draw_turn_by_constant">\n      <title name="VALUE">90</title>\n    </block>\n    ');232; if (level == 11) {; buf.push('    <block id="draw-width" type="draw_width">\n      <value name="WIDTH">\n        <block type="math_number">\n          <title name="NUM">1</title>\n        </block>\n      </value>\n    </block>\n    ');239; }; buf.push('    ');239; // Colour: draw_colour with colour_picker and colour_random.
; buf.push('    <block id="draw-color" type="draw_colour">\n      <value name="COLOUR">\n        <block type="colour_picker"></block>\n      </value>\n    </block>\n    <block id="draw-color" type="draw_colour">\n      <value name="COLOUR">\n        <block type="colour_random"></block>\n      </value>\n    </block>\n    <block type="controls_repeat">\n      <title name="TIMES">4</title>\n    </block>\n  ');252; } else if (page == 5) {; buf.push('  ');252; // K1 simplified blocks for editor: keep in sync with Dashboard artist.rb
; buf.push('    ');252; if (level >= 7) {; buf.push('      <category name="K1 Simplified">\n        <block type="controls_repeat_simplified">\n          <title name="TIMES">5</title>\n        </block>\n        <block type="draw_colour_simple"></block>\n        <block type="simple_move_up"></block>\n        <block type="simple_move_down"></block>\n        <block type="simple_move_left"></block>\n        <block type="simple_move_right"></block>\n        <block type="simple_move_up_length"></block>\n        <block type="simple_move_down_length"></block>\n        <block type="simple_move_left_length"></block>\n        <block type="simple_move_right_length"></block>\n        <block type="simple_jump_up"></block>\n        <block type="simple_jump_down"></block>\n        <block type="simple_jump_left"></block>\n        <block type="simple_jump_right"></block>\n      </category>\n    ');270; }; buf.push('    ');270; // Actions: draw_move, draw_turn.
; buf.push('    <category id="actions" name="', escape((270,  msg.catTurtle() )), '">\n      <block type="draw_move">\n        <value name="VALUE">\n          <block type="math_number">\n            <title name="NUM">100</title>\n          </block>\n        </value>\n      </block>\n      <block type="jump">\n        <value name="VALUE">\n          <block type="math_number">\n            <title name="NUM">50</title>\n          </block>\n        </value>\n      </block>\n      <block type="draw_turn">\n        <value name="VALUE">\n          <block type="math_number">\n            <title name="NUM">90</title>\n          </block>\n        </value>\n      </block>\n      <block type="draw_pen"></block>\n      <block id="draw-width" type="draw_width">\n        <value name="WIDTH">\n          <block type="math_number">\n            <title name="NUM">1</title>\n          </block>\n        </value>\n      </block>\n    </category>\n    ');301; // Colour: draw_colour with colour_picker and colour_random.
; buf.push('    <category name="', escape((301,  msg.catColour() )), '">\n      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_picker"></block>\n        </value>\n      </block>\n      <block id="draw-color" type="draw_colour">\n        <value name="COLOUR">\n          <block type="colour_random"></block>\n        </value>\n      </block>\n    </category>\n    ');313; // Functions
; buf.push('    <category name="', escape((313,  msg.catProcedures() )), '" custom="PROCEDURE"></category>\n    ');314; // Control: controls_for_counter and repeat.
; buf.push('    <category name="', escape((314,  msg.catControl() )), '">\n      <block type="controls_for_counter">\n        <value name="FROM">\n          <block type="math_number">\n            <title name="NUM">1</title>\n          </block>\n        </value>\n        <value name="TO">\n          <block type="math_number">\n            <title name="NUM">100</title>\n          </block>\n        </value>\n        <value name="BY">\n          <block type="math_number">\n            <title name="NUM">10</title>\n          </block>\n        </value>\n      </block>\n      ');332; if (level < 6) {; buf.push('        <block type="controls_repeat">\n          <title name="TIMES">4</title>\n        </block>\n      ');335; } else {; buf.push('        <block type="controls_repeat_ext">\n          <value name="TIMES">\n            <block type="math_number">\n              <title name="NUM">10</title>\n            </block>\n          </value>\n        </block>\n      ');342; }; buf.push('    </category>\n  ');343; // Logic
; buf.push('    <category name="', escape((343,  msg.catLogic() )), '">\n      <block type="controls_if"></block>\n      <block type="logic_compare"></block>\n      <block type="logic_operation"></block>\n      <block type="logic_negate"></block>\n      <block type="logic_boolean"></block>\n      <block type="logic_null"></block>\n      <block type="logic_ternary"></block>\n    </category>\n    ');352; // Math: Just number blocks until final level.
; buf.push('    <category name="', escape((352,  msg.catMath() )), '">\n      <block type="math_number"></block>\n      <block type="math_arithmetic" inline="true"></block>\n      <block type="math_random_int">\n        <value name="FROM">\n          <block type="math_number">\n            <title name="NUM">1</title>\n          </block>\n        </value>\n        <value name="TO">\n          <block type="math_number">\n            <title name="NUM">100</title>\n          </block>\n        </value>\n      </block>\n      <block type="math_random_float"></block>\n     </category>\n    ');369; // Variables
; buf.push('    <category name="', escape((369,  msg.catVariables() )), '" custom="VARIABLE">\n    </category>\n  ');371; }; buf.push('</xml>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/af_za/turtle":37,"ejs":38}],33:[function(require,module,exports){
/**
 * Blockly Demo: Turtle Graphics
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
 * @fileoverview Demonstration of Blockly: Turtle Graphics.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

window.Turtle = module.exports;

/**
 * Create a namespace for the application.
 */
var BlocklyApps = require('../base');
var Turtle = module.exports;
var msg = require('../../locale/af_za/turtle');
var skins = require('../skins');
var levels = require('./levels');
var Colours = require('./core').Colours;
var codegen = require('../codegen');
var api = require('./api');
var page = require('../templates/page.html');

var level;
var skin;

BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = false;
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = 1;

Turtle.HEIGHT = 400;
Turtle.WIDTH = 400;

/**
 * PID of animation task currently executing.
 */
Turtle.pid = 0;

/**
 * Colours used in current animation, represented as hex strings
 * (e.g., "#a0b0c0").
 */
Turtle.coloursUsed = [];

/**
 * Should the turtle be drawn?
 */
Turtle.visible = true;

/**
 * The avatar image
 */
Turtle.avatarImage = new Image();
Turtle.numberAvatarHeadings = undefined;

/**
 * Initialize Blockly and the turtle.  Called on page load.
 */
Turtle.init = function(config) {

  skin = config.skin;
  level = config.level;

  Turtle.AVATAR_HEIGHT = 51;
  Turtle.AVATAR_WIDTH = 70;

  config.html = page({
    assetUrl: BlocklyApps.assetUrl,
    data: {
      localeDirection: BlocklyApps.localeDirection(),
      controls: require('./controls.html')({assetUrl: BlocklyApps.assetUrl}),
      blockUsed : undefined,
      idealBlockNumber : undefined,
      blockCounterClass : 'block-counter-default'
    }
  });

  config.loadAudio = function() {
    Blockly.loadAudio_(skin.winSound, 'win');
    Blockly.loadAudio_(skin.startSound, 'start');
    Blockly.loadAudio_(skin.failureSound, 'failure');
  };

  config.afterInject = function() {
    // Add to reserved word list: API, local variables in execution evironment
    // (execute) and the infinite loop detection function.
    //XXX Not sure if this is still right.
    Blockly.JavaScript.addReservedWords('Turtle,code');
 
    // Helper for creating canvas elements.
    var createCanvas = function(id, width, height) {
      var el = document.createElement('canvas');
      el.id = id;
      el.width = width;
      el.height = height;
      return el;
    };
  
    // Create hidden canvases.
    Turtle.ctxAnswer = createCanvas('answer', 400, 400).getContext('2d');
    Turtle.ctxImages = createCanvas('images', 400, 400).getContext('2d');
    Turtle.ctxScratch = createCanvas('scratch', 400, 400).getContext('2d');    
    Turtle.ctxFeedback = createCanvas('feedback', 154, 154).getContext('2d');
  
    // Create display canvas.
    var display = createCanvas('display', 400, 400);
    var visualization = document.getElementById('visualization');
    visualization.appendChild(display);
    Turtle.ctxDisplay = display.getContext('2d');
    
    // Set their initial contents.
    Turtle.loadTurtle();
    Turtle.drawImages();
    Turtle.drawAnswer(level.solutionBlocks);

    // Adjust visualization and belowVisualization width.
    var drawAreaWidth = config.getDisplayWidth();
    visualization.style.width = drawAreaWidth + 'px';
    var belowVisualization = document.getElementById('belowVisualization');
    belowVisualization.style.width = drawAreaWidth + 'px';
  };

  config.getDisplayWidth = function() {
    return document.getElementById('display').width;
  };

  BlocklyApps.init(config);
};

/**
 * On startup draw the expected answer and save it to the answer canvas.
 */
Turtle.drawAnswer = function(blocks) {
  if (blocks) {
    var domBlocks = Blockly.Xml.textToDom(blocks);
    Blockly.Xml.domToWorkspace(Blockly.mainWorkspace, domBlocks);
    var code = Blockly.Generator.workspaceToCode('JavaScript');
    Turtle.evalCode(code);
    Blockly.mainWorkspace.clear();
  } else {
    BlocklyApps.log = level.answer;
  }
  BlocklyApps.reset();
  while (BlocklyApps.log.length) {
    var tuple = BlocklyApps.log.shift();
    Turtle.step(tuple[0], tuple.splice(1));
  }
  Turtle.ctxAnswer.globalCompositeOperation = 'copy';
  Turtle.ctxAnswer.drawImage(Turtle.ctxScratch.canvas, 0, 0);
  Turtle.ctxAnswer.globalCompositeOperation = 'source-over';
};

/**
 * Place an image at the specified coordinates.
 * Code from http://stackoverflow.com/questions/5495952. Thanks, Phrogz.
 * @param {string} filename Relative path to image.
 * @param {!Array} position An x-y pair.
 */
Turtle.placeImage = function(filename, position) {
  var img = new Image();
  img.onload = function() {
    Turtle.ctxImages.drawImage(img, position[0], position[1]);
    Turtle.display();
  };
  img.src = BlocklyApps.assetUrl('media/turtle/' + filename);
};

/**
 * Draw the images for this page and level onto Turtle.ctxImages.
 */
Turtle.drawImages = function() {
  if (!level.images) {
    return;
  }
  for (var i = 0; i < level.images.length; i++) {
    var image = level.images[i];
    Turtle.placeImage(image.filename, image.position);
  }
  Turtle.ctxImages.globalCompositeOperation = 'copy';
  Turtle.ctxImages.drawImage(Turtle.ctxScratch.canvas, 0, 0);
  Turtle.ctxImages.globalCompositeOperation = 'source-over';
};

/**
 * Initial the turtle image on load.
 */
Turtle.loadTurtle = function() {
  Turtle.avatarImage.onload = function() {
    Turtle.display();
  };
  Turtle.avatarImage.src = skin.avatar;
  Turtle.numberAvatarHeadings = 180;
  Turtle.avatarImage.height = Turtle.AVATAR_HEIGHT;
  Turtle.avatarImage.width = Turtle.AVATAR_WIDTH;
};

/**
 * Draw the turtle image based on Turtle.x, Turtle.y, and Turtle.heading.
 */
Turtle.drawTurtle = function() {
  // Computes the index of the image in the sprite.
  var index = Math.floor(Turtle.heading * Turtle.numberAvatarHeadings / 360);
  var sourceX = Turtle.avatarImage.width * index;
  var sourceY = 0;
  var sourceWidth = Turtle.avatarImage.width;
  var sourceHeight = Turtle.avatarImage.height;
  var destWidth = Turtle.avatarImage.width;
  var destHeight = Turtle.avatarImage.height;
  var destX = Turtle.x - destWidth / 2;
  var destY = Turtle.y - destHeight + 7;

  Turtle.ctxDisplay.drawImage(Turtle.avatarImage, sourceX, sourceY,
                              sourceWidth, sourceHeight, destX, destY,
                              destWidth, destHeight);
};

/**
 * Reset the turtle to the start position, clear the display, and kill any
 * pending tasks.
 * @param {boolean} ignore Required by the API but ignored by this
 *     implementation.
 */
BlocklyApps.reset = function(ignore) {
  // Standard starting location and heading of the turtle.
  Turtle.x = Turtle.HEIGHT / 2;
  Turtle.y = Turtle.WIDTH / 2;
  Turtle.heading = level.startDirection !== undefined ?
      level.startDirection : 90;
  Turtle.penDownValue = true;
  Turtle.visible = true;

  // For special cases, use a different initial location.
  if (level.initialX !== undefined) {
    Turtle.x = level.initialX;
  }
  if (level.initialY !== undefined) {
    Turtle.y = level.initialY;
  }
  // Clear the display.
  Turtle.ctxScratch.canvas.width = Turtle.ctxScratch.canvas.width;
  Turtle.ctxScratch.strokeStyle = '#000000';
  Turtle.ctxScratch.fillStyle = '#000000';
  Turtle.ctxScratch.lineWidth = 5;
  Turtle.ctxScratch.lineCap = 'round';
  Turtle.ctxScratch.font = 'normal 18pt Arial';
  Turtle.display();

  // Clear the feedback.
  Turtle.ctxFeedback.clearRect(
      0, 0, Turtle.ctxFeedback.canvas.width, Turtle.ctxFeedback.canvas.height);

  // Kill any task.
  if (Turtle.pid) {
    window.clearTimeout(Turtle.pid);
  }
  Turtle.pid = 0;
  Turtle.coloursUsed = [];

  // Stop the looping sound.
  BlocklyApps.stopLoopingAudio('start');
};

/**
 * Copy the scratch canvas to the display canvas. Add a turtle marker.
 */
Turtle.display = function() {
  Turtle.ctxDisplay.globalCompositeOperation = 'copy';
  // Draw the answer layer.
  Turtle.ctxDisplay.globalAlpha = 0.15;
  Turtle.ctxDisplay.drawImage(Turtle.ctxAnswer.canvas, 0, 0);
  Turtle.ctxDisplay.globalAlpha = 1;

  // Draw the images layer.
  Turtle.ctxDisplay.globalCompositeOperation = 'source-over';
  Turtle.ctxDisplay.drawImage(Turtle.ctxImages.canvas, 0, 0);

  // Draw the user layer.
  Turtle.ctxDisplay.globalCompositeOperation = 'source-over';
  Turtle.ctxDisplay.drawImage(Turtle.ctxScratch.canvas, 0, 0);

  // Draw the turtle.
  if (Turtle.visible) {
    Turtle.drawTurtle();
  }
};

/**
 * Click the run button.  Start the program.
 */
BlocklyApps.runButtonClick = function() {
  document.getElementById('runButton').style.display = 'none';
  document.getElementById('resetButton').style.display = 'inline';
  document.getElementById('spinner').style.visibility = 'visible';
  Blockly.mainWorkspace.traceOn(true);
  BlocklyApps.attempts++;
  Turtle.execute();
};

Turtle.evalCode = function(code) {
  try {
    codegen.evalWith(code, {
      BlocklyApps: BlocklyApps,
      Turtle: api
    });
  } catch (e) {
    // Null is thrown for infinite loop.
    // Otherwise, abnormal termination is a user error.
    if (e !== null) {
      window.alert(e);
    }
  }
};

/**
 * Execute the user's code.  Heaven help us...
 */
Turtle.execute = function() {
  BlocklyApps.log = [];
  BlocklyApps.ticks = 1000000;

  Turtle.code = Blockly.Generator.workspaceToCode('JavaScript');
  Turtle.evalCode(Turtle.code);

  // BlocklyApps.log now contains a transcript of all the user's actions.
  // Reset the graphic and animate the transcript.
  BlocklyApps.reset();
  BlocklyApps.playAudio('start', {volume : 0.5, loop : true});
  Turtle.pid = window.setTimeout(Turtle.animate, 100);
};

/**
 * Iterate through the recorded path and animate the turtle's actions.
 */
Turtle.animate = function() {
  // All tasks should be complete now.  Clean up the PID list.
  Turtle.pid = 0;

  var tuple = BlocklyApps.log.shift();
  if (!tuple) {
    document.getElementById('spinner').style.visibility = 'hidden';
    Blockly.mainWorkspace.highlightBlock(null);
    Turtle.checkAnswer();
    return;
  }
  var command = tuple.shift();
  BlocklyApps.highlight(tuple.pop());
  Turtle.step(command, tuple);
  Turtle.display();

  // Scale the speed non-linearly, to give better precision at the fast end.
  var stepSpeed = 1000 * Math.pow(1 - Turtle.speedSlider.getValue(), 2);
  Turtle.pid = window.setTimeout(Turtle.animate, stepSpeed);
};

/**
 * Execute one step.
 * @param {string} command Logo-style command (e.g. 'FD' or 'RT').
 * @param {!Array} values List of arguments for the command.
 */
Turtle.step = function(command, values) {
  switch (command) {
    case 'FD':  // Forward
      Turtle.moveForwardAndDraw_(values[0]);
      break;
    case 'JF':  // Jump forward
      Turtle.moveForward_(values[0]);
      break;
    case 'MV':  // Move (direction)
      var distance = values[0];
      var heading = values[1];
      Turtle.setHeading_(heading);
      Turtle.moveForwardAndDraw_(distance);
      break;
    case 'JD':  // Jump (direction)
      distance = values[0];
      heading = values[1];
      Turtle.setHeading_(heading);
      Turtle.moveForward_(distance);
      break;
    case 'RT':  // Right Turn
      Turtle.turnByDegrees_(values[0]);
      break;
    case 'DP':  // Draw Print
      Turtle.ctxScratch.save();
      Turtle.ctxScratch.translate(Turtle.x, Turtle.y);
      Turtle.ctxScratch.rotate(2 * Math.PI * (Turtle.heading - 90) / 360);
      Turtle.ctxScratch.fillText(values[0], 0, 0);
      Turtle.ctxScratch.restore();
      break;
    case 'DF':  // Draw Font
      Turtle.ctxScratch.font = values[2] + ' ' + values[1] + 'pt ' + values[0];
      break;
    case 'PU':  // Pen Up
      Turtle.penDownValue = false;
      break;
    case 'PD':  // Pen Down
      Turtle.penDownValue = true;
      break;
    case 'PW':  // Pen Width
      Turtle.ctxScratch.lineWidth = values[0];
      break;
    case 'PC':  // Pen Colour
      Turtle.ctxScratch.strokeStyle = values[0];
      Turtle.ctxScratch.fillStyle = values[0];
      break;
    case 'HT':  // Hide Turtle
      Turtle.visible = false;
      break;
    case 'ST':  // Show Turtle
      Turtle.visible = true;
      break;
  }
};

Turtle.startPathIfPenDown_ = function () {
  if (!Turtle.penDownValue) {
    return;
  }

  Turtle.ctxScratch.beginPath();
  Turtle.ctxScratch.moveTo(Turtle.x, Turtle.y);
};

Turtle.moveForward_ = function (distance) {
  Turtle.x += distance * Math.sin(2 * Math.PI * Turtle.heading / 360);
  Turtle.y -= distance * Math.cos(2 * Math.PI * Turtle.heading / 360);
};

Turtle.moveByRelativePosition_ = function (x, y) {
  Turtle.x += x;
  Turtle.y += y;
};

Turtle.drawPathToTurtle_ = function (x, y) {
  Turtle.ctxScratch.lineTo(x, y);
  Turtle.ctxScratch.stroke();
};

Turtle.markCurrentColourUsed_ = function () {
  var colour = Turtle.ctxScratch.strokeStyle.toLowerCase();
  if (Turtle.coloursUsed.indexOf(colour) == -1) {
    Turtle.coloursUsed.push(colour);
  }
};

Turtle.drawDotAtTurtle_ = function (x, y) {
  // WebKit (unlike Gecko) draws nothing for a zero-length line, so draw a very short line.
  var dotLineLength = 0.1;
  Turtle.ctxScratch.lineTo(x, y + dotLineLength);
  Turtle.ctxScratch.stroke();
};

Turtle.drawToTurtleIfPenDown_ = function (distance) {
  if (!Turtle.penDownValue) {
    return;
  }

  var isDot = (distance === 0);
  if (isDot) {
    Turtle.drawDotAtTurtle_(Turtle.x, Turtle.y);
  } else {
    Turtle.drawPathToTurtle_(Turtle.x, Turtle.y);
  }
  Turtle.markCurrentColourUsed_();
};

Turtle.turnByDegrees_ = function (degreesRight) {
  Turtle.setHeading_(Turtle.heading + degreesRight);
};

Turtle.setHeading_ = function (heading) {
  heading = Turtle.constrainDegrees_(heading);
  Turtle.heading = heading;
};

Turtle.constrainDegrees_ = function (degrees) {
  degrees %= 360;
  if (degrees < 0) {
    degrees += 360;
  }
  return degrees;
};

Turtle.moveForwardAndDraw_ = function (distance) {
  Turtle.startPathIfPenDown_();
  Turtle.moveForward_(distance);
  Turtle.drawToTurtleIfPenDown_(distance);
};

/**
 * The range of outcomes for evaluating the colour used on the current level.
 * @type {number}
 */
Turtle.ColourResults = {
  OK: 0,
  NONE: 1,               // No colours were used.
  FORBIDDEN_DEFAULT: 2,  // Default colour (black) was used but not permitted.
  TOO_FEW: 3,            // Fewer distinct colours were used than required.
  EXTRA: 4               // All of the required colours and more were used.
  // There is no value for "wrong colour" because we use
  // the name of the colour (as a string) instead.
};

/**
 * Returns the name of the property key in Colours whose value
 * is the given hex string.
 * @param {!string} hex The JavaScript representation of a hexadecimal
 *        value (such as "#0123ab").  The hex digits a-f must be lower-case.
 * @return {string} The name of the colour, or "UNKNOWN".  The latter
 *        should only be returned if the colour was not from Colours.
 */
Turtle.hexStringToColourName = function(hex) {
  for (var name in Colours) {
    if (Colours[name] == hex) {
      return name.toLowerCase();
    }
  }
  return 'UNKNOWN';  //  This should not happen.
};

/**
 * Check whether any required colours are present.
 * This uses level.requiredColors and Turtle.coloursUsed.
 * @return {number|string} The appropriate value in Turtle.ColourResults or
 *     the name of a missing required colour.
 */
Turtle.checkRequiredColours = function() {
  // level.requiredColors values and their meanings are:
  // - 1: There must be at least one non-black colour.
  // - 2 or higher: There must be the specified number of colours (black okay).
  // - string: The entire picture must use the named colour.
  if (!level.requiredColors) {
    return Turtle.ColourResults.OK;
  }
  if (Turtle.coloursUsed === 0) {
    return Turtle.ColourResults.NONE;
  } else if (typeof level.requiredColors == 'string') {
    for (var i = 0; i < Turtle.coloursUsed.length; i++) {
      if (Turtle.coloursUsed[i] == level.requiredColors) {
        return Turtle.coloursUsed.length == 1 ? Turtle.ColourResults.OK :
            Turtle.ColourResults.EXTRA;
      }
      return Turtle.hexStringToColourName(level.requiredColors);
    }
  } else if (level.requiredColors == 1) {
    // Any colour but black is acceptable.
    if (Turtle.coloursUsed.length == 1 &&
        Turtle.coloursUsed[0] == Colours.BLACK) {
      return Turtle.ColourResults.FORBIDDEN_DEFAULT;
    } else {
      return Turtle.ColourResults.OK;
    }
  } else {
    // level.requiredColors must be a number greater than 1.
    var surplus = Turtle.coloursUsed.length - level.requiredColors;
    if (surplus > 0) {
      return Turtle.ColourResult.EXTRA;
    } else if (surplus === 0) {
      return Turtle.ColourResults.OK;
    } else {
      return Turtle.ColourResults.TOO_FEW;
    }
  }
};

/**
 * Validate whether the user's answer is correct.
 * @param {number} pixelErrors Number of pixels that are wrong.
 * @param {number} permittedErrors Number of pixels allowed to be wrong.
 * @return {boolean} True if the level is solved, false otherwise.
 */
var isCorrect = function(pixelErrors, permittedErrors) {
  return pixelErrors < permittedErrors;
};

/**
 * App specific displayFeedback function that calls into
 * BlocklyApps.displayFeedback when appropriate
 */
var displayFeedback = function() {
  BlocklyApps.displayFeedback({
    app: 'turtle', //XXX
    skin: skin.id,
    feedbackType: Turtle.testResults,
    message: Turtle.message,
    response: Turtle.response,
    level: level,
    feedbackImage: Turtle.ctxScratch.canvas.toDataURL("image/png"),
    // add 'impressive':true to non-freeplay levels that we deem are relatively impressive (see #66990480)
    showingSharing: level.freePlay || level.impressive,
    // impressive levels are already saved
    alreadySaved: level.impressive,
    // allow users to save freeplay levels to their gallery (impressive non-freeplay levels are autosaved)
    saveToGalleryUrl: level.freePlay && Turtle.response.save_to_gallery_url,
    appStrings: {
      reinfFeedbackMsg: msg.reinfFeedbackMsg(),
      sharingText: msg.shareDrawing()
    }
  });
};

/**
 * Function to be called when the service report call is complete
 * @param {object} JSON response (if available)
 */
Turtle.onReportComplete = function(response) {
  Turtle.response = response;
  // Disable the run button until onReportComplete is called.
  var runButton = document.getElementById('runButton');
  runButton.disabled = false;
  displayFeedback();
};

/**
 * Verify if the answer is correct.
 * If so, move on to next level.
 */
Turtle.checkAnswer = function() {
  // Compare the Alpha (opacity) byte of each pixel in the user's image and
  // the sample answer image.
  var userImage =
      Turtle.ctxScratch.getImageData(0, 0, Turtle.WIDTH, Turtle.HEIGHT);
  var answerImage =
      Turtle.ctxAnswer.getImageData(0, 0, Turtle.WIDTH, Turtle.HEIGHT);
  var len = Math.min(userImage.data.length, answerImage.data.length);
  var delta = 0;
  // Pixels are in RGBA format.  Only check the Alpha bytes.
  for (var i = 3; i < len; i += 4) {
    // Copying and compositing images across canvases seems to distort the
    // alpha. Use a large error value (250) to compensate.
    if (Math.abs(userImage.data[i] - answerImage.data[i]) > 250) {
      delta++;
    }
  }

  // Allow some number of pixels to be off, but be stricter
  // for certain levels.
  var permittedErrors;
  if (level.permittedErrors !== undefined) {
    permittedErrors = level.permittedErrors;
  } else {
    permittedErrors = 150;
  }
  // Test whether the current level is a free play level, or the level has
  // been completed
  BlocklyApps.levelComplete =
      level.freePlay || isCorrect(delta, permittedErrors);
  Turtle.testResults = BlocklyApps.getTestResults();

  var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
  var textBlocks = Blockly.Xml.domToText(xml);

  // For levels where using too many blocks would allow students
  // to miss the point, convert that feedback to a failure.
  if (level.failForTooManyBlocks &&
      Turtle.testResults == BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL) {
    // TODO: Add more helpful error message.
    Turtle.testResults = BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL;

  } else if ((Turtle.testResults ==
      BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL) ||
      (Turtle.testResults == BlocklyApps.TestResults.ALL_PASS)) {
    // Check that they didn't use a crazy large repeat value when drawing a
    // circle.  This complains if the limit doesn't start with 3.
    // Note that this level does not use colour, so no need to check for that.
    if (level.failForCircleRepeatValue) {
      var code = Blockly.Generator.workspaceToCode('JavaScript');
      if (code.indexOf('count < 3') == -1) {
          Turtle.testResults = BlocklyApps.TestResults.OTHER_2_STAR_FAIL;
      }
    } else {
      // Only check and mention colour if there is no more serious problem.
      var colourResult = Turtle.checkRequiredColours();
      if (colourResult != Turtle.ColourResults.OK &&
        colourResult != Turtle.ColourResults.EXTRA) {
        var message = '';
        Turtle.testResults = BlocklyApps.TestResults.OTHER_1_STAR_FAIL;
        if (colourResult == Turtle.ColourResults.FORBIDDEN_DEFAULT) {
          message = msg.notBlackColour();
        } else if (colourResult == Turtle.ColourResults.TOO_FEW) {
          message = msg.tooFewColours();
          message = message.replace('%1', level.requiredColors);
          message = message.replace('%2', Turtle.coloursUsed.length);
        } else if (typeof colourResult == 'string') {
          message = msg.wrongColour().replace('%1', colourResult);
        }
        Turtle.message = message;
      }
    }
  }

  // If the current level is a free play, always return the free play
  // result type
  if (level.freePlay) {
    Turtle.testResults = BlocklyApps.TestResults.FREE_PLAY;
  }

  // Play sound
  BlocklyApps.stopLoopingAudio('start');
  if (Turtle.testResults === BlocklyApps.TestResults.FREE_PLAY ||
      Turtle.testResults >= BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL) {
    BlocklyApps.playAudio('win', {volume : 0.5});
  } else {
    BlocklyApps.playAudio('failure', {volume : 0.5});
  }

  var reportData = {
      app: 'turtle',
      level: level.id,
      builder: level.builder,
      result: BlocklyApps.levelComplete,
      testResult: Turtle.testResults,
      program: encodeURIComponent(textBlocks),
      onComplete: Turtle.onReportComplete
  };

  // Get the canvas data for feedback.
  if (Turtle.testResults >= BlocklyApps.TestResults.TOO_MANY_BLOCKS_FAIL) {
    reportData.image = getFeedbackImage();
  }

  if (level.impressive) {
    reportData.save_to_gallery = true;
  }

  BlocklyApps.report(reportData);

  // The call to displayFeedback() will happen later in onReportComplete()
};

var getFeedbackImage = function() {
  // Copy the user layer
  Turtle.ctxFeedback.globalCompositeOperation = 'copy';
  Turtle.ctxFeedback.drawImage(Turtle.ctxScratch.canvas, 0, 0, 154, 154);
  var feedbackCanvas = Turtle.ctxFeedback.canvas;
  return encodeURIComponent(
      feedbackCanvas.toDataURL("image/png").split(',')[1]);
};

},{"../../locale/af_za/turtle":37,"../base":2,"../codegen":6,"../skins":10,"../templates/page.html":18,"./api":24,"./controls.html":26,"./core":27,"./levels":28}],34:[function(require,module,exports){
exports.shallowCopy = function(source) {
  var result = {};
  for (var prop in source) {
    result[prop] = source[prop];
  }

  return result;
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

},{}],35:[function(require,module,exports){
// Serializes an XML DOM node to a string.
exports.serialize = function(node) {
  var serializer = new XMLSerializer();
  return serializer.serializeToString(node);
};

// Parses a single root element string.
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
var MessageFormat = require("messageformat");MessageFormat.locale.af=function(n){return n===1?"one":"other"}
exports.blocklyMessage = function(d){return "Blockly"};

exports.catActions = function(d){return "Aksies"};

exports.catColour = function(d){return "Kleur"};

exports.catLogic = function(d){return "Logic"};

exports.catLists = function(d){return "Lyste"};

exports.catLoops = function(d){return "Loops"};

exports.catMath = function(d){return "Math"};

exports.catProcedures = function(d){return "Functions"};

exports.catText = function(d){return "Teks"};

exports.catVariables = function(d){return "Variables"};

exports.codeTooltip = function(d){return "See generated JavaScript code."};

exports.continue = function(d){return "Gaan voort"};

exports.dialogCancel = function(d){return "Kanselleer"};

exports.dialogOK = function(d){return "OK"};

exports.directionNorthLetter = function(d){return "N"};

exports.directionSouthLetter = function(d){return "S"};

exports.directionEastLetter = function(d){return "E"};

exports.directionWestLetter = function(d){return "W"};

exports.emptyBlocksErrorMsg = function(d){return "The \"Repeat\" or \"If\" block needs to have other blocks inside it to work. Make sure the inner block fits properly inside the containing block."};

exports.extraTopBlocks = function(d){return "You have extra blocks that aren't attached to an event block."};

exports.finalStage = function(d){return "Congratulations! You have completed the final stage."};

exports.finalStageTrophies = function(d){return "Congratulations! You have completed the final stage and won "+p(d,"numTrophies",0,"af",{"one":"a trophy","other":n(d,"numTrophies")+" trophies"})+"."};

exports.generatedCodeInfo = function(d){return "The blocks for your program can also be represented in JavaScript, the world's most widely adopted programming language:"};

exports.hashError = function(d){return "Sorry, '%1' doesn't correspond with any saved program."};

exports.help = function(d){return "Help"};

exports.hintTitle = function(d){return "Hint:"};

exports.jump = function(d){return "jump"};

exports.levelIncompleteError = function(d){return "You are using all of the necessary types of blocks but not in the right way."};

exports.listVariable = function(d){return "lys"};

exports.makeYourOwnFlappy = function(d){return "Make Your Own Flappy Game"};

exports.missingBlocksErrorMsg = function(d){return "Try one or more of the blocks below to solve this puzzle."};

exports.nextLevel = function(d){return "Congratulations! You completed Puzzle "+v(d,"puzzleNumber")+"."};

exports.nextLevelTrophies = function(d){return "Congratulations! You completed Puzzle "+v(d,"puzzleNumber")+" and won "+p(d,"numTrophies",0,"af",{"one":"a trophy","other":n(d,"numTrophies")+" trophies"})+"."};

exports.nextStage = function(d){return "Congratulations! You completed Stage "+v(d,"stageNumber")+"."};

exports.nextStageTrophies = function(d){return "Congratulations! You completed Stage "+v(d,"stageNumber")+" and won "+p(d,"numTrophies",0,"af",{"one":"a trophy","other":n(d,"numTrophies")+" trophies"})+"."};

exports.numBlocksNeeded = function(d){return "Congratulations! You completed Puzzle "+v(d,"puzzleNumber")+". (However, you could have used only "+p(d,"numBlocks",0,"af",{"one":"1 block","other":n(d,"numBlocks")+" blocks"})+".)"};

exports.numLinesOfCodeWritten = function(d){return "You just wrote "+p(d,"numLines",0,"af",{"one":"1 line","other":n(d,"numLines")+" lines"})+" of code!"};

exports.puzzleTitle = function(d){return "Puzzle "+v(d,"puzzle_number")+" of "+v(d,"stage_total")};

exports.resetProgram = function(d){return "Stel terug"};

exports.runProgram = function(d){return "Run Program"};

exports.runTooltip = function(d){return "Run the program defined by the blocks in the workspace."};

exports.showCodeHeader = function(d){return "Show Code"};

exports.showGeneratedCode = function(d){return "Show code"};

exports.subtitle = function(d){return "a visual programming environment"};

exports.textVariable = function(d){return "teks"};

exports.tooFewBlocksMsg = function(d){return "You are using all of the necessary types of blocks, but try using more  of these types of blocks to complete this puzzle."};

exports.tooManyBlocksMsg = function(d){return "This puzzle can be solved with <x id='START_SPAN'/><x id='END_SPAN'/> blocks."};

exports.tooMuchWork = function(d){return "You made me do a lot of work!  Could you try repeating fewer times?"};

exports.flappySpecificFail = function(d){return "Your code looks good - it will flap with each click. But you need to click many times to flap to the target."};

exports.toolboxHeader = function(d){return "Blokke"};

exports.openWorkspace = function(d){return "How It Works"};

exports.totalNumLinesOfCodeWritten = function(d){return "All-time total: "+p(d,"numLines",0,"af",{"one":"1 line","other":n(d,"numLines")+" lines"})+" of code."};

exports.tryAgain = function(d){return "Probeer weer"};

exports.backToPreviousLevel = function(d){return "Back to previous level"};

exports.saveToGallery = function(d){return "Save to your gallery"};

exports.savedToGallery = function(d){return "Saved to your gallery!"};

exports.typeCode = function(d){return "Type your JavaScript code below these instructions."};

exports.typeFuncs = function(d){return "Available functions:%1"};

exports.typeHint = function(d){return "Note that the parentheses and semicolons are required."};

exports.workspaceHeader = function(d){return "Assemble your blocks here: "};

exports.infinity = function(d){return "Oneindig"};

exports.rotateText = function(d){return "Rotate your device."};

exports.orientationLock = function(d){return "Turn off orientation lock in device settings."};

exports.wantToLearn = function(d){return "Want to learn to code?"};

exports.watchVideo = function(d){return "Watch the Video"};

exports.tryHOC = function(d){return "Try the Hour of Code"};

exports.signup = function(d){return "Sign up for the intro course"};

exports.hintHeader = function(d){return "Here's a tip:"};


},{"messageformat":49}],37:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.af=function(n){return n===1?"one":"other"}
exports.blocksUsed = function(d){return "Blocks used: %1"};

exports.catColour = function(d){return "Color"};

exports.catControl = function(d){return "Loops"};

exports.catMath = function(d){return "Math"};

exports.catProcedures = function(d){return "Functions"};

exports.catTurtle = function(d){return "Actions"};

exports.catVariables = function(d){return "Variables"};

exports.catLogic = function(d){return "Logic"};

exports.colourTooltip = function(d){return "Changes the color of the pencil."};

exports.degrees = function(d){return "degrees"};

exports.dots = function(d){return "pixels"};

exports.drawASquare = function(d){return "draw a square"};

exports.drawATriangle = function(d){return "draw a triangle"};

exports.drawACircle = function(d){return "draw a circle"};

exports.drawAHouse = function(d){return "draw a house"};

exports.drawATree = function(d){return "draw a tree"};

exports.drawASnowman = function(d){return "draw a snowman"};

exports.heightParameter = function(d){return "height"};

exports.hideTurtle = function(d){return "hide artist"};

exports.jump = function(d){return "jump"};

exports.jumpBackward = function(d){return "jump backward by"};

exports.jumpForward = function(d){return "jump forward by"};

exports.jumpTooltip = function(d){return "Moves the artist without leaving any marks."};

exports.lengthParameter = function(d){return "length"};

exports.loopVariable = function(d){return "counter"};

exports.moveBackward = function(d){return "move backward by"};

exports.moveForward = function(d){return "move forward by"};

exports.moveForwardTooltip = function(d){return "Moves the artist forward."};

exports.moveTooltip = function(d){return "Moves the artist forward or backward by the specified amount."};

exports.notBlackColour = function(d){return "You need to set a color other than black for this puzzle."};

exports.numBlocksNeeded = function(d){return "This puzzle can be solved with %1 blocks.  You used %2."};

exports.penDown = function(d){return "pencil down"};

exports.penTooltip = function(d){return "Lifts or lowers the pencil, to start or stop drawing."};

exports.penUp = function(d){return "pencil up"};

exports.reinfFeedbackMsg = function(d){return "Does this look like what you want? You can press the \"Try again\" button to see your drawing."};

exports.setColour = function(d){return "set color"};

exports.setWidth = function(d){return "set width"};

exports.shareDrawing = function(d){return "Share your drawing:"};

exports.showMe = function(d){return "Show me"};

exports.showTurtle = function(d){return "show artist"};

exports.tooFewColours = function(d){return "You need to use at least %1 different colors for this puzzle.  You used only %2."};

exports.turnLeft = function(d){return "turn left by"};

exports.turnRight = function(d){return "turn right by"};

exports.turnRightTooltip = function(d){return "Turns the artist right by the specified angle."};

exports.turnTooltip = function(d){return "Turns the artist left or right by the specified number of degrees."};

exports.turtleVisibilityTooltip = function(d){return "Makes the artist visible or invisible."};

exports.widthTooltip = function(d){return "Changes the width of the pencil."};

exports.wrongColour = function(d){return "Your picture is the wrong color.  For this puzzle, it needs to be %1."};


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

},{}]},{},[29])