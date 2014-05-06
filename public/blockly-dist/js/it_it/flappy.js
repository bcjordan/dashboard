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
var msg = require('../locale/it_it/common');
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

},{"../locale/it_it/common":33,"./builder":5,"./dom":7,"./feedback.js":8,"./slider":19,"./templates/buttons.html":21,"./templates/instructions.html":23,"./templates/learn.html":24,"./templates/makeYourOwn.html":25,"./utils":31,"./xml":32}],3:[function(require,module,exports){
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

},{"./dom.js":7,"./feedback.js":8,"./templates/builder.html":20,"./utils.js":31,"url":45}],6:[function(require,module,exports){
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
var msg = require('../locale/it_it/common');
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


},{"../locale/it_it/common":33,"./codegen":6,"./dom":7,"./templates/buttons.html":21,"./templates/code.html":22,"./templates/readonly.html":27,"./templates/sharing.html":28,"./templates/showCode.html":29,"./templates/trophy.html":30,"./utils":31}],9:[function(require,module,exports){
exports.FlapHeight = {
  VERY_SMALL: -6,
  SMALL: -8,
  NORMAL: -11,
  LARGE: -13,
  VERY_LARGE: -15
};

exports.LevelSpeed = {
  VERY_SLOW: 1,
  SLOW: 3,
  NORMAL: 4,
  FAST: 6,
  VERY_FAST: 8
};

exports.GapHeight = {
  VERY_SMALL: 65,
  SMALL: 75,
  NORMAL: 100,
  LARGE: 125,
  VERY_LARGE: 150
};

exports.Gravity = {
  VERY_LOW: 0.5,
  LOW: 0.75,
  NORMAL: 1,
  HIGH: 1.25,
  VERY_HIGH: 1.5
};

exports.random = function (values) {
  var key = Math.floor(Math.random() * values.length); 
  return values[key];
};

exports.setScore = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.playerScore = value;
  Flappy.displayScore();
};

exports.setGravity = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.gravity = value;
};

exports.setGround = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setGround(value);
};

exports.setObstacle = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setObstacle(value);
};

exports.setPlayer = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setPlayer(value);
};

exports.setGapHeight = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setGapHeight(value);
};

exports.setBackground = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.setBackground(value);
};

exports.setSpeed = function (id, value) {
  BlocklyApps.highlight(id);
  Flappy.SPEED = value;
};

exports.playSound = function(id, soundName) {
  BlocklyApps.highlight(id);
  BlocklyApps.playAudio(soundName, {volume: 0.5});
};

exports.flap = function (id, amount) {
  BlocklyApps.highlight(id);
  Flappy.flap(amount);
};

exports.endGame = function (id) {
  BlocklyApps.highlight(id);
  Flappy.gameState = Flappy.GameStates.ENDING;
};

exports.incrementPlayerScore = function(id) {
  BlocklyApps.highlight(id);
  Flappy.playerScore++;
  Flappy.displayScore();
};

},{}],10:[function(require,module,exports){
/**
 * Blockly App: Flappy
 *
 * Copyright 2013 Code.org
 *
 */
'use strict';

var msg = require('../../locale/it_it/flappy');

var generateSetterCode = function (ctx, name) {
  var value = ctx.getTitleValue('VALUE');
  if (value === "random") {
    var allValues = ctx.VALUES.slice(1).map(function (item) {
      return item[1];
    });
    value = 'Flappy.random([' + allValues + '])';
  }

  return 'Flappy.' + name + '(\'block_id_' + ctx.id + '\', ' +
    value + ');\n';
};

// Install extensions to Blockly's language and JavaScript generator.
exports.install = function(blockly, skin) {

  var generator = blockly.Generator.get('JavaScript');
  blockly.JavaScript = generator;

  blockly.Blocks.flappy_whenClick = {
    // Block to handle event where mouse is clicked
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenClick());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenClickTooltip());
    }
  };

  generator.flappy_whenClick = function () {
    // Generate JavaScript for handling click event.
    return '\n';
  };

  blockly.Blocks.flappy_whenCollideGround = {
    // Block to handle event where flappy hits ground
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenCollideGround());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenCollideGroundTooltip());
    }
  };

  generator.flappy_whenCollideGround = function () {
    // Generate JavaScript for handling click event.
    return '\n';
  };

  blockly.Blocks.flappy_whenCollideObstacle = {
    // Block to handle event where flappy hits a Obstacle
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenCollideObstacle());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenCollideObstacleTooltip());
    }
  };

  generator.flappy_whenCollideObstacle = function () {
    // Generate JavaScript for handling collide Obstacle event.
    return '\n';
  };

  blockly.Blocks.flappy_whenEnterObstacle = {
    // Block to handle event where flappy enters a Obstacle
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenEnterObstacle());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenEnterObstacleTooltip());
    }
  };

  generator.flappy_whenEnterObstacle = function () {
    // Generate JavaScript for handling enter Obstacle.
    return '\n';
  };

  generator.flappy_whenRunButtonClick = function () {
    // Generate JavaScript for handling run button click.
    return '\n';
  };

  blockly.Blocks.flappy_whenRunButtonClick = {
    // Block to handle event where run button is clicked
    helpUrl: '',
    init: function () {
      this.setHSV(140, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.whenRunButtonClick());
      this.setPreviousStatement(false);
      this.setNextStatement(true);
      this.setTooltip(msg.whenRunButtonClickTooltip());
    }
  };

  generator.flappy_whenRunButtonClick = function () {
    // Generate JavaScript for handling run button click
    return '\n';
  };

  blockly.Blocks.flappy_flap = {
    // Block for flapping (flying upwards)
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.flap());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.flapTooltip());
    }
  };

  generator.flappy_flap = function (velocity) {
    // Generate JavaScript for moving left.
    return 'Flappy.flap(\'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.flappy_flap_height = {
    // Block for flapping (flying upwards)
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]); // default to normal

      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.flapTooltip());
    }
  };

  blockly.Blocks.flappy_flap_height.VALUES =
      [[msg.flapRandom(), 'random'],
       [msg.flapVerySmall(), 'Flappy.FlapHeight.VERY_SMALL'],
       [msg.flapSmall(), 'Flappy.FlapHeight.SMALL'],
       [msg.flapNormal(), 'Flappy.FlapHeight.NORMAL'],
       [msg.flapLarge(), 'Flappy.FlapHeight.LARGE'],
       [msg.flapVeryLarge(), 'Flappy.FlapHeight.VERY_LARGE']];

  generator.flappy_flap_height = function (velocity) {
    return generateSetterCode(this, 'flap');
  };

  blockly.Blocks.flappy_playSound = {
    // Block for playing sound.
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[7][1]);
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.playSoundTooltip());
    }
  };

  blockly.Blocks.flappy_playSound.VALUES =
      [[msg.playSoundRandom(), 'random'],
       [msg.playSoundBounce(), '"wall"'],
       [msg.playSoundCrunch(), '"wall0"'],
       [msg.playSoundDie(), '"sfx_die"'],
       [msg.playSoundHit(), '"sfx_hit"'],
       [msg.playSoundPoint(), '"sfx_point"'],
       [msg.playSoundSwoosh(), '"sfx_swooshing"'],
       [msg.playSoundWing(), '"sfx_wing"'],
       [msg.playSoundJet(), '"jet"'],
       [msg.playSoundCrash(), '"crash"'],
       [msg.playSoundJingle(), '"jingle"'],
       [msg.playSoundSplash(), '"splash"'],
       [msg.playSoundLaser(), '"laser"']
     ];

  generator.flappy_playSound = function() {
    return generateSetterCode(this, 'playSound');
  };

  blockly.Blocks.flappy_incrementPlayerScore = {
    // Block for incrementing the player's score.
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.incrementPlayerScore());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.incrementPlayerScoreTooltip());
    }
  };

  generator.flappy_incrementPlayerScore = function() {
    // Generate JavaScript for incrementing the player's score.
    return 'Flappy.incrementPlayerScore(\'block_id_' + this.id + '\');\n';
  };

  blockly.Blocks.flappy_endGame = {
    helpUrl: '',
    init: function() {
      this.setHSV(184, 1.00, 0.74);
      this.appendDummyInput()
        .appendTitle(msg.endGame());
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.endGameTooltip());
    }
  };

  generator.flappy_endGame = function() {
    // Generate JavaScript for incrementing the player's score.
    return 'Flappy.endGame(\'block_id_' + this.id + '\');\n';
  };

  /**
   * setSpeed
   */
  blockly.Blocks.flappy_setSpeed = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]);  // default to normal

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setSpeedTooltip());
    }
  };

  blockly.Blocks.flappy_setSpeed.VALUES =
      [[msg.speedRandom(), 'random'],
       [msg.speedVerySlow(), 'Flappy.LevelSpeed.VERY_SLOW'],
       [msg.speedSlow(), 'Flappy.LevelSpeed.SLOW'],
       [msg.speedNormal(), 'Flappy.LevelSpeed.NORMAL'],
       [msg.speedFast(), 'Flappy.LevelSpeed.FAST'],
       [msg.speedVeryFast(), 'Flappy.LevelSpeed.VERY_FAST']];

  generator.flappy_setSpeed = function() {
    return generateSetterCode(this, 'setSpeed');
  };

  /**
   * setGapHeight
   */
  blockly.Blocks.flappy_setGapHeight = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]);  // default to normal

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setGapHeightTooltip());
    }
  };

  blockly.Blocks.flappy_setGapHeight.VALUES =
      [[msg.setGapRandom(), 'random'],
       [msg.setGapVerySmall(), 'Flappy.GapHeight.VERY_SMALL'],
       [msg.setGapSmall(), 'Flappy.GapHeight.SMALL'],
       [msg.setGapNormal(), 'Flappy.GapHeight.NORMAL'],
       [msg.setGapLarge(), 'Flappy.GapHeight.LARGE'],
       [msg.setGapVeryLarge(), 'Flappy.GapHeight.VERY_LARGE']];

  generator.flappy_setGapHeight = function() {
    return generateSetterCode(this, 'setGapHeight');
  };

  /**
   * setBackground
   */
  blockly.Blocks.flappy_setBackground = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setBackgroundTooltip());
    }
  };

  blockly.Blocks.flappy_setBackground.VALUES =
      [[msg.setBackgroundRandom(), 'random'],
       [msg.setBackgroundFlappy(), '"flappy"'],
       [msg.setBackgroundNight(), '"night"'],
       [msg.setBackgroundSciFi(), '"scifi"'],
       [msg.setBackgroundUnderwater(), '"underwater"'],
       [msg.setBackgroundCave(), '"cave"'],
       [msg.setBackgroundSanta(), '"santa"']];

  generator.flappy_setBackground = function() {
    return generateSetterCode(this, 'setBackground');
  };

  /**
   * setPlayer
   */
  blockly.Blocks.flappy_setPlayer = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setPlayerTooltip());
    }
  };

  blockly.Blocks.flappy_setPlayer.VALUES =
      [[msg.setPlayerRandom(), 'random'],
       [msg.setPlayerFlappy(), '"flappy"'],
       [msg.setPlayerRedBird(), '"redbird"'],
       [msg.setPlayerSciFi(), '"scifi"'],
       [msg.setPlayerUnderwater(), '"underwater"'],
       [msg.setPlayerSanta(), '"santa"'],
       [msg.setPlayerCave(), '"cave"'],
       [msg.setPlayerShark(), '"shark"'],
       [msg.setPlayerEaster(), '"easter"'],
       [msg.setPlayerBatman(), '"batman"'],
       [msg.setPlayerSubmarine(), '"submarine"'],
       [msg.setPlayerUnicorn(), '"unicorn"'],
       [msg.setPlayerFairy(), '"fairy"'],
       [msg.setPlayerSuperman(), '"superman"'],
       [msg.setPlayerTurkey(), '"turkey"']];

  generator.flappy_setPlayer = function() {
    return generateSetterCode(this, 'setPlayer');
  };

  /**
   * setObstacle
   */
  blockly.Blocks.flappy_setObstacle = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setObstacleTooltip());
    }
  };

  blockly.Blocks.flappy_setObstacle.VALUES =
      [[msg.setObstacleRandom(), 'random'],
       [msg.setObstacleFlappy(), '"flappy"'],
       [msg.setObstacleSciFi(), '"scifi"'],
       [msg.setObstacleUnderwater(), '"underwater"'],
       [msg.setObstacleCave(), '"cave"'],
       [msg.setObstacleSanta(), '"santa"'],
       [msg.setObstacleLaser(), '"laser"']];

  generator.flappy_setObstacle = function() {
    return generateSetterCode(this, 'setObstacle');
  };

  /**
   * setGround
   */
  blockly.Blocks.flappy_setGround = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[1][1]);  // default to flappy

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setGroundTooltip());
    }
  };

  blockly.Blocks.flappy_setGround.VALUES =
      [[msg.setGroundRandom(), 'random'],
       [msg.setGroundFlappy(), '"flappy"'],
       [msg.setGroundSciFi(), '"scifi"'],
       [msg.setGroundUnderwater(), '"underwater"'],
       [msg.setGroundCave(), '"cave"'],
       [msg.setGroundSanta(), '"santa"'],
       [msg.setGroundLava(), '"lava"']];

  generator.flappy_setGround = function() {
    return generateSetterCode(this, 'setGround');
  };

  /**
   * setGravity
   */
  blockly.Blocks.flappy_setGravity = {
    helpUrl: '',
    init: function() {
      var dropdown = new blockly.FieldDropdown(this.VALUES);
      dropdown.setValue(this.VALUES[3][1]);  // default to normal

      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(dropdown, 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setGravityTooltip());
    }
  };

  blockly.Blocks.flappy_setGravity.VALUES =
      [[msg.setGravityRandom(), 'random'],
       [msg.setGravityVeryLow(), 'Flappy.Gravity.VERY_LOW'],
       [msg.setGravityLow(), 'Flappy.Gravity.LOW'],
       [msg.setGravityNormal(), 'Flappy.Gravity.NORMAL'],
       [msg.setGravityHigh(), 'Flappy.Gravity.HIGH'],
       [msg.setGravityVeryHigh(), 'Flappy.Gravity.VERY_HIGH']
      ];

  generator.flappy_setGravity = function() {
    return generateSetterCode(this, 'setGravity');
  };

  blockly.Blocks.flappy_setScore = {
    // Block for moving forward or backward the internal number of pixels.
    init: function() {
      this.setHSV(312, 0.32, 0.62);
      this.appendDummyInput()
          .appendTitle(msg.setScore())
          .appendTitle(new blockly.FieldTextInput('0',
            blockly.FieldTextInput.numberValidator), 'VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setTooltip(msg.setScoreTooltip());
    }
  };

  generator.flappy_setScore = function() {
    // Generate JavaScript for moving forward or backward the internal number of
    // pixels.
    var value = window.parseInt(this.getTitleValue('VALUE'), 10);
    return 'Flappy.setScore(\'block_id_' + this.id + '\', ' + value + ');\n';
  };

  delete blockly.Blocks.procedures_defreturn;
  delete blockly.Blocks.procedures_ifreturn;
};

},{"../../locale/it_it/flappy":34}],11:[function(require,module,exports){
module.exports = {
  WORKSPACE_BUFFER: 20,
  WORKSPACE_COL_WIDTH: 210,
  WORKSPACE_ROW_HEIGHT: 120,

  AVATAR_HEIGHT: 24,
  AVATAR_WIDTH: 34,
  AVATAR_Y_OFFSET: 0
};
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
 buf.push('');1; var msg = require('../../locale/it_it/flappy') ; buf.push('\n\n<td id="share-cell" class="share-cell-none">\n  <button id="shareButton" class="share">\n    <img src="', escape((5,  assetUrl('media/1x1.gif') )), '">\n    ', escape((6,  msg.share() )), '\n  </button>\n</td>'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/flappy":34,"ejs":35}],13:[function(require,module,exports){
/**
 * Blockly App: Flappy
 *
 * Copyright 2013 Code.org
 *
 */

'use strict';

var BlocklyApps = require('../base');
var commonMsg = require('../../locale/it_it/common');
var flappyMsg = require('../../locale/it_it/flappy');
var skins = require('../skins');
var codegen = require('../codegen');
var api = require('./api');
var page = require('../templates/page.html');
var feedback = require('../feedback.js');
var dom = require('../dom');
var constants = require('./constants');

/**
 * Create a namespace for the application.
 */
var Flappy = module.exports;

Flappy.GameStates = {
  WAITING: 0,
  ACTIVE: 1,
  ENDING: 2,
  OVER: 3
};

Flappy.gameState = Flappy.GameStates.WAITING;

Flappy.clickPending = false;

Flappy.avatarVelocity = 0;

var level;
var skin;
var onSharePage;

Flappy.obstacles = [];

/**
 * Milliseconds between each animation frame.
 */
var stepSpeed;

// whether to show Get Ready and Game Over
var infoText;

//TODO: Make configurable.
BlocklyApps.CHECK_FOR_EMPTY_BLOCKS = true;

var randomObstacleHeight = function () {
  var min = Flappy.MIN_OBSTACLE_HEIGHT;
  var max = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - Flappy.MIN_OBSTACLE_HEIGHT - Flappy.GAP_SIZE;
  return Math.floor((Math.random() * (max - min)) + min);
};

//The number of blocks to show as feedback.
BlocklyApps.NUM_REQUIRED_BLOCKS_TO_FLAG = 1;

// Default Scalings
Flappy.scale = {
  'snapRadius': 1,
  'stepSpeed': 33
};

var twitterOptions = {
  text: flappyMsg.shareFlappyTwitter(),
  hashtag: "FlappyCode"
};

var AVATAR_HEIGHT = constants.AVATAR_HEIGHT;
var AVATAR_WIDTH = constants.AVATAR_WIDTH;
var AVATAR_Y_OFFSET = constants.AVATAR_Y_OFFSET;

var loadLevel = function() {
  // Load maps.
  infoText = (level.infoText === undefined ? true : level.infoText);
  if (!infoText) {
    Flappy.gameState = Flappy.GameStates.ACTIVE;
  }

  // Override scalars.
  for (var key in level.scale) {
    Flappy.scale[key] = level.scale[key];
  }

  // Height and width of the goal and obstacles.
  Flappy.MARKER_HEIGHT = 43;
  Flappy.MARKER_WIDTH = 50;

  Flappy.MAZE_WIDTH = 400;
  Flappy.MAZE_HEIGHT = 400;

  Flappy.GROUND_WIDTH = 400;
  Flappy.GROUND_HEIGHT = 48;

  Flappy.GOAL_SIZE = 55;

  Flappy.OBSTACLE_WIDTH = 52;
  Flappy.OBSTACLE_HEIGHT = 320;
  Flappy.MIN_OBSTACLE_HEIGHT = 48;

  Flappy.setGapHeight(api.GapHeight.NORMAL);

  Flappy.OBSTACLE_SPACING = 250; // number of horizontal pixels between the start of obstacles

  var numObstacles = 2 * Flappy.MAZE_WIDTH / Flappy.OBSTACLE_SPACING;
  if (!level.obstacles) {
    numObstacles = 0;
  }

  var resetObstacle = function (x) {
    this.x = x;
    this.gapStart = randomObstacleHeight();
    this.hitAvatar = false;
  };

  var containsAvatar = function () {
    var flappyRight = Flappy.avatarX + AVATAR_WIDTH;
    var flappyBottom = Flappy.avatarY + AVATAR_HEIGHT;
    var obstacleRight = this.x + Flappy.OBSTACLE_WIDTH;
    var obstacleBottom = this.gapStart + Flappy.GAP_SIZE;
    return (flappyRight > this.x &&
      flappyRight < obstacleRight &&
      Flappy.avatarY > this.gapStart &&
      flappyBottom < obstacleBottom);
  };

  for (var i = 0; i < numObstacles; i++) {
    Flappy.obstacles.push({
      x: Flappy.MAZE_WIDTH * 1.5 + i * Flappy.OBSTACLE_SPACING,
      gapStart: randomObstacleHeight(), // y coordinate of the top of the gap
      hitAvatar: false,
      reset: resetObstacle,
      containsAvatar: containsAvatar
    });
  }
};

var drawMap = function() {
  var svg = document.getElementById('svgFlappy');
  var i, x, y, k, tile;

  // Adjust outer element size.
  svg.setAttribute('width', Flappy.MAZE_WIDTH);
  svg.setAttribute('height', Flappy.MAZE_HEIGHT);

  // Adjust visualization and belowVisualization width.
  var visualization = document.getElementById('visualization');
  visualization.style.width = Flappy.MAZE_WIDTH + 'px';
  var belowVisualization = document.getElementById('belowVisualization');
  belowVisualization.style.width = Flappy.MAZE_WIDTH + 'px';

  // Adjust button table width.
  var buttonTable = document.getElementById('gameButtons');
  buttonTable.style.width = Flappy.MAZE_WIDTH + 'px';

  var hintBubble = document.getElementById('bubble');
  hintBubble.style.width = Flappy.MAZE_WIDTH + 'px';

  if (skin.background) {
    tile = document.createElementNS(Blockly.SVG_NS, 'image');
    tile.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                        skin.background);
    tile.setAttribute('id', 'background');
    tile.setAttribute('height', Flappy.MAZE_HEIGHT);
    tile.setAttribute('width', Flappy.MAZE_WIDTH);
    tile.setAttribute('x', 0);
    tile.setAttribute('y', 0);
    svg.appendChild(tile);
  }

  // Add obstacles
  Flappy.obstacles.forEach (function (obstacle, index) {
    var obstacleTopIcon = document.createElementNS(Blockly.SVG_NS, 'image');
    obstacleTopIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.obstacle_top);
    obstacleTopIcon.setAttribute('id', 'obstacle_top' + index);
    obstacleTopIcon.setAttribute('height', Flappy.OBSTACLE_HEIGHT);
    obstacleTopIcon.setAttribute('width', Flappy.OBSTACLE_WIDTH);
    svg.appendChild(obstacleTopIcon);

    var obstacleBottomIcon = document.createElementNS(Blockly.SVG_NS, 'image');
    obstacleBottomIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.obstacle_bottom);
    obstacleBottomIcon.setAttribute('id', 'obstacle_bottom' + index);
    obstacleBottomIcon.setAttribute('height', Flappy.OBSTACLE_HEIGHT);
    obstacleBottomIcon.setAttribute('width', Flappy.OBSTACLE_WIDTH);
    svg.appendChild(obstacleBottomIcon);
  });

  if (level.ground) {
    for (i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
      var groundIcon = document.createElementNS(Blockly.SVG_NS, 'image');
      groundIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.ground);
      groundIcon.setAttribute('id', 'ground' + i);
      groundIcon.setAttribute('height', Flappy.GROUND_HEIGHT);
      groundIcon.setAttribute('width', Flappy.GROUND_WIDTH);
      groundIcon.setAttribute('x', 0);
      groundIcon.setAttribute('y', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
      svg.appendChild(groundIcon);
    }
  }

  if (level.goal && level.goal.startX) {
    var goal = document.createElementNS(Blockly.SVG_NS, 'image');
    goal.setAttribute('id', 'goal');
    goal.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                            skin.goal);
    goal.setAttribute('height', Flappy.GOAL_SIZE);
    goal.setAttribute('width', Flappy.GOAL_SIZE);
    goal.setAttribute('x', level.goal.startX);
    goal.setAttribute('y', level.goal.startY);
    svg.appendChild(goal);
  }

  var avatArclip = document.createElementNS(Blockly.SVG_NS, 'clipPath');
  avatArclip.setAttribute('id', 'avatArclipPath');
  var avatArclipRect = document.createElementNS(Blockly.SVG_NS, 'rect');
  avatArclipRect.setAttribute('id', 'avatArclipRect');
  avatArclipRect.setAttribute('width', Flappy.MAZE_WIDTH);
  avatArclipRect.setAttribute('height', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
  avatArclip.appendChild(avatArclipRect);
  svg.appendChild(avatArclip);

  // Add avatar.
  var avatarIcon = document.createElementNS(Blockly.SVG_NS, 'image');
  avatarIcon.setAttribute('id', 'avatar');
  avatarIcon.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                          skin.avatar);
  avatarIcon.setAttribute('height', AVATAR_HEIGHT);
  avatarIcon.setAttribute('width', AVATAR_WIDTH);
  if (level.ground) {
    avatarIcon.setAttribute('clip-path', 'url(#avatArclipPath)');
  }
  svg.appendChild(avatarIcon);

  var instructions = document.createElementNS(Blockly.SVG_NS, 'image');
  instructions.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.instructions);
  instructions.setAttribute('id', 'instructions');
  instructions.setAttribute('height', 50);
  instructions.setAttribute('width', 159);
  instructions.setAttribute('x', 110);
  instructions.setAttribute('y', 170);
  instructions.setAttribute('visibility', 'hidden');
  svg.appendChild(instructions);

  var getready = document.createElementNS(Blockly.SVG_NS, 'image');
  getready.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.getready);
  getready.setAttribute('id', 'getready');
  getready.setAttribute('height', 50);
  getready.setAttribute('width', 183);
  getready.setAttribute('x', 108);
  getready.setAttribute('y', 80);
  getready.setAttribute('visibility', 'hidden');
  svg.appendChild(getready);

  var clickrun = document.createElementNS(Blockly.SVG_NS, 'image');
  clickrun.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.clickrun);
  clickrun.setAttribute('id', 'clickrun');
  clickrun.setAttribute('height', 41);
  clickrun.setAttribute('width', 273);
  clickrun.setAttribute('x', 64);
  clickrun.setAttribute('y', 200);
  clickrun.setAttribute('visibility', 'visibile');
  svg.appendChild(clickrun);

  var gameover = document.createElementNS(Blockly.SVG_NS, 'image');
  gameover.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                              skin.gameover);
  gameover.setAttribute('id', 'gameover');
  gameover.setAttribute('height', 41);
  gameover.setAttribute('width', 192);
  gameover.setAttribute('x', 104);
  gameover.setAttribute('y', 80);
  gameover.setAttribute('visibility', 'hidden');
  svg.appendChild(gameover);

  var score = document.createElementNS(Blockly.SVG_NS, 'text');
  score.setAttribute('id', 'score');
  score.setAttribute('class', 'flappy-score');
  score.setAttribute('x', Flappy.MAZE_WIDTH / 2);
  score.setAttribute('y', 60);
  score.appendChild(document.createTextNode('0'));
  score.setAttribute('visibility', 'hidden');
  svg.appendChild(score);

  var clickRect = document.createElementNS(Blockly.SVG_NS, 'rect');
  clickRect.setAttribute('width', Flappy.MAZE_WIDTH);
  clickRect.setAttribute('height', Flappy.MAZE_HEIGHT);
  clickRect.setAttribute('fill-opacity', 0);
  clickRect.addEventListener('touchstart', function (e) {
    Flappy.onMouseDown(e);
    e.preventDefault(); // don't want to see mouse down
  });
  clickRect.addEventListener('mousedown', function (e) {
    Flappy.onMouseDown(e);
  });
  svg.appendChild(clickRect);
};

Flappy.calcDistance = function(xDist, yDist) {
  return Math.sqrt(xDist * xDist + yDist * yDist);
};

var essentiallyEqual = function(float1, float2, opt_variance) {
  var variance = opt_variance || 0.01;
  return (Math.abs(float1 - float2) < variance);
};

/**
 * Check to see if avatar is in collision with given obstacle
 * @param obstacle Object : The obstacle object we're checking
 */
var checkForObstacleCollision = function (obstacle) {
  var insideObstacleColumn = Flappy.avatarX + AVATAR_WIDTH >= obstacle.x &&
    Flappy.avatarX <= obstacle.x + Flappy.OBSTACLE_WIDTH;
  if (insideObstacleColumn && (Flappy.avatarY <= obstacle.gapStart ||
    Flappy.avatarY + AVATAR_HEIGHT >= obstacle.gapStart + Flappy.GAP_SIZE)) {
    return true;
  }
  return false;
};

Flappy.activeTicks = function () {
  if (Flappy.firstActiveTick < 0) {
    return 0;
  }

  return (Flappy.tickCount - Flappy.firstActiveTick);
};

Flappy.onTick = function() {
  var avatarWasAboveGround, avatarIsAboveGround;

  if (Flappy.firstActiveTick < 0 && Flappy.gameState === Flappy.GameStates.ACTIVE) {
    Flappy.firstActiveTick = Flappy.tickCount;
  }

  Flappy.tickCount++;

  if (Flappy.tickCount === 1) {
    try { Flappy.whenRunButton(BlocklyApps, api); } catch (e) { }
  }

  // Check for click
  if (Flappy.clickPending && Flappy.gameState <= Flappy.GameStates.ACTIVE) {
    try { Flappy.whenClick(BlocklyApps, api); } catch (e) { }
    Flappy.clickPending = false;
  }

  avatarWasAboveGround = (Flappy.avatarY + AVATAR_HEIGHT) <
    (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);

  // Action doesn't start until user's first click
  if (Flappy.gameState === Flappy.GameStates.ACTIVE) {
    // Update avatar's vertical position
    Flappy.avatarVelocity += Flappy.gravity;
    Flappy.avatarY = Flappy.avatarY + Flappy.avatarVelocity;

    // never let the avatar go too far off the top or bottom
    var bottomLimit = level.ground ?
      (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - AVATAR_HEIGHT + 1) :
      (Flappy.MAZE_HEIGHT * 1.5);

    Flappy.avatarY = Math.min(Flappy.avatarY, bottomLimit);
    Flappy.avatarY = Math.max(Flappy.avatarY, Flappy.MAZE_HEIGHT * -0.5);

    // Update obstacles
    Flappy.obstacles.forEach(function (obstacle, index) {
      var wasRightOfAvatar = obstacle.x > (Flappy.avatarX + AVATAR_WIDTH);

      obstacle.x -= Flappy.SPEED;

      var isRightOfAvatar = obstacle.x > (Flappy.avatarX + AVATAR_WIDTH);
      if (wasRightOfAvatar && !isRightOfAvatar) {
        if (Flappy.avatarY > obstacle.gapStart &&
          (Flappy.avatarY + AVATAR_HEIGHT < obstacle.gapStart + Flappy.GAP_SIZE)) {
          try { Flappy.whenEnterObstacle(BlocklyApps, api); } catch (e) { }
        }
      }

      if (!obstacle.hitAvatar && checkForObstacleCollision(obstacle)) {
        obstacle.hitAvatar = true;
        try {Flappy.whenCollideObstacle(BlocklyApps, api); } catch (e) { }
      }

      // If obstacle moves off left side, repurpose as a new obstacle to our right
      var numObstacles = Flappy.obstacles.length;
      var previousObstacleIndex = (index - 1 + numObstacles ) % numObstacles;
      if (obstacle.x + Flappy.OBSTACLE_WIDTH < 0) {
        obstacle.reset(Flappy.obstacles[previousObstacleIndex].x + Flappy.OBSTACLE_SPACING);
      }
    });

    // check for ground collision
    avatarIsAboveGround = (Flappy.avatarY + AVATAR_HEIGHT) <
      (Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
    if (avatarWasAboveGround && !avatarIsAboveGround) {
      try { Flappy.whenCollideGround(BlocklyApps, api); } catch (e) { }
    }

    // update goal
    if (level.goal && level.goal.moving) {
      Flappy.goalX -= Flappy.SPEED;
      if (Flappy.goalX + Flappy.GOAL_SIZE < 0) {
        // if it disappears off of left, reappear on right
        Flappy.goalX = Flappy.MAZE_WIDTH + Flappy.GOAL_SIZE;
      }
    }
  }

  if (Flappy.gameState === Flappy.GameStates.ENDING) {
    Flappy.avatarY += 10;

    // we use avatar width instead of height bc he is rotating
    // the extra 4 is so that he buries his beak (similar to mobile game)
    var max = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT - AVATAR_WIDTH + 4;
    if (Flappy.avatarY >= max) {
      Flappy.avatarY = max;
      Flappy.gameState = Flappy.GameStates.OVER;
      Flappy.gameOverTick = Flappy.tickCount;
    }

    document.getElementById('avatar').setAttribute('transform',
      'translate(' + AVATAR_WIDTH + ', 0) ' +
      'rotate(90, ' + Flappy.avatarX + ', ' + Flappy.avatarY + ')');
    if (infoText) {
      document.getElementById('gameover').setAttribute('visibility', 'visibile');
    }
  }

  Flappy.displayAvatar(Flappy.avatarX, Flappy.avatarY);
  Flappy.displayObstacles();
  if (Flappy.gameState <= Flappy.GameStates.ACTIVE) {
    Flappy.displayGround(Flappy.tickCount);
    Flappy.displayGoal();
  }

  if (checkFinished()) {
    Flappy.onPuzzleComplete();
  }
};

Flappy.onMouseDown = function (e) {
  if (Flappy.intervalId) {
    Flappy.clickPending = true;
    if (Flappy.gameState === Flappy.GameStates.WAITING) {
      Flappy.gameState = Flappy.GameStates.ACTIVE;
    } else if (Flappy.gameState === Flappy.GameStates.OVER &&
      Flappy.gameOverTick + 10 < Flappy.tickCount) {
      // do a reset
      var resetButton = document.getElementById('resetButton');
      if (resetButton) {
        resetButton.click();
      }
    }
    document.getElementById('instructions').setAttribute('visibility', 'hidden');
    document.getElementById('getready').setAttribute('visibility', 'hidden');
  } else if (Flappy.gameState === Flappy.GameStates.WAITING) {
    BlocklyApps.runButtonClick();
  }
};
/**
 * Initialize Blockly and the Flappy app.  Called on page load.
 */
Flappy.init = function(config) {
  Flappy.clearEventHandlersKillTickLoop();
  skin = config.skin;
  level = config.level;
  onSharePage = config.share;
  loadLevel();

  config.html = page({
    assetUrl: BlocklyApps.assetUrl,
    data: {
      localeDirection: BlocklyApps.localeDirection(),
      visualization: require('./visualization.html')(),
      controls: require('./controls.html')({assetUrl: BlocklyApps.assetUrl}),
      blockUsed: undefined,
      idealBlockNumber: undefined,
      blockCounterClass: 'block-counter-default'
    }
  });

  config.loadAudio = function() {
    Blockly.loadAudio_(skin.winSound, 'win');
    Blockly.loadAudio_(skin.startSound, 'start');
    Blockly.loadAudio_(skin.failureSound, 'failure');
    Blockly.loadAudio_(skin.obstacleSound, 'obstacle');

    Blockly.loadAudio_(skin.dieSound, 'sfx_die');
    Blockly.loadAudio_(skin.hitSound, 'sfx_hit');
    Blockly.loadAudio_(skin.pointSound, 'sfx_point');
    Blockly.loadAudio_(skin.swooshingSound, 'sfx_swooshing');
    Blockly.loadAudio_(skin.wingSound, 'sfx_wing');
    Blockly.loadAudio_(skin.winGoalSound, 'winGoal');
    Blockly.loadAudio_(skin.jetSound, 'jet');
    Blockly.loadAudio_(skin.jingleSound, 'jingle');
    Blockly.loadAudio_(skin.crashSound, 'crash');
    Blockly.loadAudio_(skin.laserSound, 'laser');
    Blockly.loadAudio_(skin.splashSound, 'splash');
    Blockly.loadAudio_(skin.wallSound, 'wall');
    Blockly.loadAudio_(skin.wall0Sound, 'wall0');
  };

  config.afterInject = function() {
    /**
     * The richness of block colours, regardless of the hue.
     * MOOC blocks should be brighter (target audience is younger).
     * Must be in the range of 0 (inclusive) to 1 (exclusive).
     * Blockly's default is 0.45.
     */
    Blockly.HSV_SATURATION = 0.6;

    Blockly.SNAP_RADIUS *= Flappy.scale.snapRadius;

    drawMap();
  };

  config.getDisplayWidth = function() {
    var visualization = document.getElementById('visualization');
    return visualization.getBoundingClientRect().width;
  };

  config.trashcan = false;

  config.twitter = twitterOptions;

  // for flappy show make your own button if on share page
  config.makeYourOwn = config.share;
  
  config.makeString = commonMsg.makeYourOwnFlappy();
  config.makeUrl = "http://code.org/flappy";
  config.makeImage = BlocklyApps.assetUrl('media/flappy_promo.png');

  config.enableShowCode = false;

  config.preventExtraTopLevelBlocks = true;

  // define how our blocks should be arranged
  var col1 = constants.WORKSPACE_BUFFER;
  var col2 = col1 + constants.WORKSPACE_COL_WIDTH;
  var row1 = constants.WORKSPACE_BUFFER;
  var row2 = row1 + constants.WORKSPACE_ROW_HEIGHT;
  var row3 = row2 + constants.WORKSPACE_ROW_HEIGHT;

  config.blockArrangement = {
    'flappy_whenClick': { x: col1, y: row1},
    'flappy_whenCollideGround': { x: col2, y: row1},
    'flappy_whenCollideObstacle': { x: col2, y: row2},
    'flappy_whenEnterObstacle': { x: col2, y: row3},
    'flappy_whenRunButtonClick': { x: col1, y: row2}
  };

  BlocklyApps.init(config);

  if (!onSharePage) {
    var shareButton = document.getElementById('shareButton');
    dom.addClickTouchEvent(shareButton, Flappy.onPuzzleComplete);
  }
};

/**
 * Clear the event handlers and stop the onTick timer.
 */
Flappy.clearEventHandlersKillTickLoop = function() {
  Flappy.whenClick = null;
  Flappy.whenCollideGround = null;
  Flappy.whenCollideObstacle = null;
  Flappy.whenEnterObstacle = null;
  Flappy.whenRunButton = null;
  if (Flappy.intervalId) {
    window.clearInterval(Flappy.intervalId);
  }
  Flappy.intervalId = 0;
};

/**
 * Reset the app to the start position and kill any pending animation tasks.
 * @param {boolean} first True if an opening animation is to be played.
 */
BlocklyApps.reset = function(first) {
  var i;
  Flappy.clearEventHandlersKillTickLoop();

  Flappy.gameState = Flappy.GameStates.WAITING;

  // Reset the score.
  Flappy.playerScore = 0;

  Flappy.avatarVelocity = 0;

  // Reset obstacles
  Flappy.obstacles.forEach(function (obstacle, index) {
    obstacle.reset(Flappy.MAZE_WIDTH * 1.5 + index * Flappy.OBSTACLE_SPACING);
  });

  // reset configurable values
  Flappy.SPEED = 0;
  Flappy.FLAP_VELOCITY = -11;
  Flappy.setBackground('flappy');
  Flappy.setObstacle('flappy');
  Flappy.setPlayer('flappy');
  Flappy.setGround('flappy');
  Flappy.setGapHeight(api.GapHeight.NORMAL);
  Flappy.gravity = api.Gravity.NORMAL;

  // Move Avatar into position.
  Flappy.avatarX = 110;
  Flappy.avatarY = 150;

  if (level.goal && level.goal.startX) {
    Flappy.goalX = level.goal.startX;
    Flappy.goalY = level.goal.startY;
  }

  document.getElementById('avatar').setAttribute('transform', '');
  document.getElementById('score').setAttribute('visibility', 'hidden');
  document.getElementById('instructions').setAttribute('visibility', 'hidden');
  document.getElementById('clickrun').setAttribute('visibility', 'visible');
  document.getElementById('getready').setAttribute('visibility', 'hidden');
  document.getElementById('gameover').setAttribute('visibility', 'hidden');

  Flappy.displayAvatar(Flappy.avatarX, Flappy.avatarY);
  Flappy.displayObstacles();
  Flappy.displayGround(0);
  Flappy.displayGoal();

  var svg = document.getElementById('svgFlappy');
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
  document.getElementById('clickrun').setAttribute('visibility', 'hidden');
  document.getElementById('instructions').setAttribute('visibility', 'visible');
  document.getElementById('getready').setAttribute('visibility', 'visible');

  runButton.style.display = 'none';
  resetButton.style.display = 'inline';
  Blockly.mainWorkspace.traceOn(true);
  // BlocklyApps.reset(false);
  BlocklyApps.attempts++;
  Flappy.execute();

  if (level.freePlay && !onSharePage) {
    var shareCell = document.getElementById('share-cell');
    shareCell.className = 'share-cell-enabled';
  }
  if (level.score) {
    document.getElementById('score').setAttribute('visibility', 'visible');
    Flappy.displayScore();
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
  if (!Flappy.waitingForReport) {
    BlocklyApps.displayFeedback({
      app: 'flappy', //XXX
      skin: skin.id,
      feedbackType: Flappy.testResults,
      response: Flappy.response,
      level: level,
      showingSharing: level.freePlay,
      twitter: twitterOptions,
      appStrings: {
        reinfFeedbackMsg: flappyMsg.reinfFeedbackMsg(),
        sharingText: flappyMsg.shareGame()
      }
    });
  }
};

/**
 * Function to be called when the service report call is complete
 * @param {object} JSON response (if available)
 */
Flappy.onReportComplete = function(response) {
  Flappy.response = response;
  Flappy.waitingForReport = false;
  // Disable the run button until onReportComplete is called.
  var runButton = document.getElementById('runButton');
  runButton.disabled = false;
  displayFeedback();
};

/**
 * Execute the user's code.  Heaven help us...
 */
Flappy.execute = function() {
  BlocklyApps.log = [];
  BlocklyApps.ticks = 100; //TODO: Set higher for some levels
  Flappy.result = ResultType.UNSET;
  Flappy.testResults = BlocklyApps.TestResults.NO_TESTS_RUN;
  Flappy.waitingForReport = false;
  Flappy.response = null;

  // Check for empty top level blocks to warn user about bugs,
  // especially ones that lead to infinite loops.
  if (feedback.hasEmptyTopLevelBlocks()) {
    Flappy.testResults = BlocklyApps.TestResults.EMPTY_BLOCK_FAIL;
    displayFeedback();
    return;
  }

  if (level.editCode) {
    var codeTextbox = document.getElementById('codeTextbox');
    var code = dom.getText(codeTextbox);
    // Insert aliases from level codeBlocks into code
    if (level.codeFunctions) {
      for (var i = 0; i < level.codeFunctions.length; i++) {
        var codeFunction = level.codeFunctions[i];
        if (codeFunction.alias) {
          code = codeFunction.func +
              " = function() { " + codeFunction.alias + " };" + code;
        }
      }
    }
  }

  var codeClick = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenClick');
  var whenClickFunc = codegen.functionFromCode(
                                      codeClick, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeCollideGround = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenCollideGround');
  var whenCollideGroundFunc = codegen.functionFromCode(
                                      codeCollideGround, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeEnterObstacle = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenEnterObstacle');
  var whenEnterObstacleFunc = codegen.functionFromCode(
                                      codeEnterObstacle, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeCollideObstacle = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenCollideObstacle');
  var whenCollideObstacleFunc = codegen.functionFromCode(
                                      codeCollideObstacle, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );

  var codeWhenRunButton = Blockly.Generator.workspaceToCode(
                                    'JavaScript',
                                    'flappy_whenRunButtonClick');
  var whenRunButtonFunc = codegen.functionFromCode(
                                      codeWhenRunButton, {
                                      BlocklyApps: BlocklyApps,
                                      Flappy: api } );


  BlocklyApps.playAudio('start', {volume: 0.5});

  // BlocklyApps.reset(false);

  // Set event handlers and start the onTick timer
  Flappy.whenClick = whenClickFunc;
  Flappy.whenCollideGround = whenCollideGroundFunc;
  Flappy.whenEnterObstacle = whenEnterObstacleFunc;
  Flappy.whenCollideObstacle = whenCollideObstacleFunc;
  Flappy.whenRunButton = whenRunButtonFunc;

  Flappy.tickCount = 0;
  Flappy.firstActiveTick = -1;
  Flappy.gameOverTick = 0;
  if (Flappy.intervalId) {
    window.clearInterval(Flappy.intervalId);
  }
  Flappy.intervalId = window.setInterval(Flappy.onTick, Flappy.scale.stepSpeed);
};

Flappy.onPuzzleComplete = function() {
  if (level.freePlay) {
    Flappy.result = ResultType.SUCCESS;
  }

  // Stop everything on screen
  Flappy.clearEventHandlersKillTickLoop();

  // If we know they succeeded, mark levelComplete true
  // Note that we have not yet animated the succesful run
  BlocklyApps.levelComplete = (Flappy.result == ResultType.SUCCESS);

  // If the current level is a free play, always return the free play
  // result type
  if (level.freePlay) {
    Flappy.testResults = BlocklyApps.TestResults.FREE_PLAY;
  } else {
    Flappy.testResults = BlocklyApps.getTestResults();
  }

  // Special case for Flappy level 1 where you have the right blocks, but you
  // don't flap to the goal.  Note: this currently depends on us getting
  // TOO_FEW_BLOCKS_FAIL, when really we should probably be getting
  // LEVEL_INCOMPLETE_FAIL here. (see pivotal item 66362504)
  if (level.id === "1" &&
    Flappy.testResults === BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL) {
    Flappy.testResults = BlocklyApps.TestResults.FLAPPY_SPECIFIC_FAIL;
  }


  if (Flappy.testResults >= BlocklyApps.TestResults.FREE_PLAY) {
    BlocklyApps.playAudio('win', {volume : 0.5});
  } else {
    BlocklyApps.playAudio('failure', {volume : 0.5});
  }

  if (level.editCode) {
    Flappy.testResults = BlocklyApps.levelComplete ?
      BlocklyApps.TestResults.ALL_PASS :
      BlocklyApps.TestResults.TOO_FEW_BLOCKS_FAIL;
  }

  if (level.failForOther1Star && !BlocklyApps.levelComplete) {
    Flappy.testResults = BlocklyApps.TestResults.OTHER_1_STAR_FAIL;
  }

  var xml = Blockly.Xml.workspaceToDom(Blockly.mainWorkspace);
  var textBlocks = Blockly.Xml.domToText(xml);

  Flappy.waitingForReport = true;

  // Report result to server.
  BlocklyApps.report({
                     app: 'flappy',
                     level: level.id,
                     result: Flappy.result === ResultType.SUCCESS,
                     testResult: Flappy.testResults,
                     program: encodeURIComponent(textBlocks),
                     onComplete: Flappy.onReportComplete
                     });
};

/**
 * Display Avatar at the specified location
 * @param {number} x Horizontal Pixel location.
 * @param {number} y Vertical Pixel location.
 */
Flappy.displayAvatar = function(x, y) {
  var avatarIcon = document.getElementById('avatar');
  avatarIcon.setAttribute('x', x);
  avatarIcon.setAttribute('y', y);
};

/**
 * display moving goal
 */
Flappy.displayGoal = function() {
  if (!Flappy.goalX) {
    return;
  }
  var goal = document.getElementById('goal');
  goal.setAttribute('x', Flappy.goalX);
  goal.setAttribute('y', Flappy.goalY);
};


/**
 * Display ground at given tickCount
 */
Flappy.displayGround = function(tickCount) {
  if (!level.ground) {
    return;
  }
  var offset = tickCount * Flappy.SPEED;
  offset = offset % Flappy.GROUND_WIDTH;
  for (var i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
    var ground = document.getElementById('ground' + i);
    ground.setAttribute('x', -offset + i * Flappy.GROUND_WIDTH);
    ground.setAttribute('y', Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT);
  }
};

/**
 * Display all obstacles
 */
Flappy.displayObstacles = function () {
  for (var i = 0; i < Flappy.obstacles.length; i++) {
    var obstacle = Flappy.obstacles[i];
    var topIcon = document.getElementById('obstacle_top' + i);
    topIcon.setAttribute('x', obstacle.x);
    topIcon.setAttribute('y', obstacle.gapStart - Flappy.OBSTACLE_HEIGHT);

    var bottomIcon = document.getElementById('obstacle_bottom' + i);
    bottomIcon.setAttribute('x', obstacle.x);
    bottomIcon.setAttribute('y', obstacle.gapStart + Flappy.GAP_SIZE);
  }
};

Flappy.displayScore = function() {
  var score = document.getElementById('score');
  score.textContent = Flappy.playerScore;
};

Flappy.flap = function (amount) {
  var defaultFlap = level.defaultFlap || "NORMAL";
  Flappy.avatarVelocity = amount || api.FlapHeight[defaultFlap];
};

Flappy.setGapHeight = function (value) {
  var minGapSize = Flappy.MAZE_HEIGHT - Flappy.MIN_OBSTACLE_HEIGHT -
    Flappy.OBSTACLE_HEIGHT;
  if (value < minGapSize) {
    value = minGapSize;
  }
  Flappy.GAP_SIZE = value;
};

var skinTheme = function (value) {
  if (value === 'flappy') {
    return skin;
  }
  return skin[value];
};

Flappy.setBackground = function (value) {
  var element = document.getElementById('background');
  element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
    skinTheme(value).background);
};

Flappy.setPlayer = function (value) {
  var element = document.getElementById('avatar');
  element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
    skinTheme(value).avatar);
};

Flappy.setObstacle = function (value) {
  var element;
  Flappy.obstacles.forEach(function (obstacle, index) {
    element = document.getElementById('obstacle_top' + index);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).obstacle_top);

    element = document.getElementById('obstacle_bottom' + index);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).obstacle_bottom);
  });
};

Flappy.setGround = function (value) {
  if (!level.ground) {
    return;
  }
  var element, i;
  for (i = 0; i < Flappy.MAZE_WIDTH / Flappy.GROUND_WIDTH + 1; i++) {
    element = document.getElementById('ground' + i);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
      skinTheme(value).ground);
  }
};

var checkTickLimit = function() {
  if (!level.tickLimit) {
    return false;
  }

  if ((Flappy.tickCount - Flappy.firstActiveTick) >= level.tickLimit &&
    (Flappy.gameState === Flappy.GameStates.ACTIVE ||
    Flappy.gameState === Flappy.GameStates.OVER)) {
    // We'll ignore tick limit if we're ending so that we fully finish ending
    // sequence
    return true;
  }

  return false;
};

var checkFinished = function () {
  // if we have a succcess condition and have accomplished it, we're done and successful
  if (level.goal && level.goal.successCondition && level.goal.successCondition()) {
    Flappy.result = ResultType.SUCCESS;
    return true;
  }

  // if we have a failure condition, and it's been reached, we're done and failed
  if (level.goal && level.goal.failureCondition && level.goal.failureCondition()) {
    Flappy.result = ResultType.FAILURE;
    return true;
  }

  return false;
};

},{"../../locale/it_it/common":33,"../../locale/it_it/flappy":34,"../base":2,"../codegen":6,"../dom":7,"../feedback.js":8,"../skins":18,"../templates/page.html":26,"./api":9,"./constants":11,"./controls.html":12,"./visualization.html":17}],14:[function(require,module,exports){
/*jshint multistr: true */

// todo - i think our prepoluated code counts as LOCs

var constants = require('./constants');
var tb = require('../block_utils').createToolbox;

var category = function (name, blocks) {
  return '<category id="' + name + '" name="' + name + '">' + blocks + '</category>';
};

var flapBlock = '<block type="flappy_flap"></block>';
var flapHeightBlock = '<block type="flappy_flap_height"></block>';
var endGameBlock = '<block type="flappy_endGame"></block>';
var playSoundBlock =  '<block type="flappy_playSound"></block>';
var incrementScoreBlock = '<block type="flappy_incrementPlayerScore"></block>';

var setSpeedBlock = '<block type="flappy_setSpeed"></block>';
var setBackgroundBlock = '<block type="flappy_setBackground"></block>';
var setGapHeightBlock = '<block type="flappy_setGapHeight"></block>';
var setPlayerBlock = '<block type="flappy_setPlayer"></block>';
var setObstacleBlock = '<block type="flappy_setObstacle"></block>';
var setGroundBlock = '<block type="flappy_setGround"></block>';
var setGravityBlock = '<block type="flappy_setGravity"></block>';
var setScoreBlock = '<block type="flappy_setScore"></block>';

var COL_WIDTH = constants.WORKSPACE_COL_WIDTH;
var COL1 = constants.WORKSPACE_BUFFER;
var COL2 = COL1 + COL_WIDTH;

var ROW_HEIGHT = constants.WORKSPACE_ROW_HEIGHT;
var ROW1 = constants.WORKSPACE_BUFFER;
var ROW2 = ROW1 + ROW_HEIGHT;
var ROW3 = ROW2 + ROW_HEIGHT;

var AVATAR_HEIGHT = constants.AVATAR_HEIGHT;
var AVATAR_WIDTH = constants.AVATAR_WIDTH;
var AVATAR_Y_OFFSET = constants.AVATAR_Y_OFFSET;

var eventBlock = function (type, x, y, child) {
  return '<block type="' + type + '" deletable="false"' +
    ' x="' + x + '"' +
    ' y="' + y + '">' +
    (child ? '<next>' + child + '</next>' : '') +
    '</block>';
};

/*
 * Configuration for all levels.
 */

 /**
  * Explanation of options:
  * goal.startX/startY
  * - start location of flag image
  * goal.moving
  * - whether the goal stays in one spot or moves at level's speed
  * goal.successCondition
  * - condition(s), which if true at any point, indicate user has successfully
  *   completed the puzzle
  * goal.failureCondition
  * - condition(s), which if true at any point, indicates the puzzle is
      complete (indicating failure if success condition not met)
  */

module.exports = {
  '1': {
    'requiredBlocks': [
      [{'test': 'flap', 'type': 'flappy_flap'}]
    ],
    'obstacles': false,
    'ground': false,
    'score': false,
    'freePlay': false,
    'goal': {
      startX  : 100,
      startY: 0,
      successCondition: function () {
        return (Flappy.avatarY  <= 40);
      },
      failureCondition: function () {
        return Flappy.avatarY > Flappy.MAZE_HEIGHT;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + playSoundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1)
  },

  '2': {
    'requiredBlocks': [
      [{'test': 'endGame', 'type': 'flappy_endGame'}]
    ],
    'obstacles': false,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 100,
      startY: 400 - 48 - 56 / 2,
      successCondition: function () {
        // this only happens after avatar hits ground, and we spin him because of
        // game over
        return (Flappy.avatarY  === 322 && Flappy.avatarX === 110);
      },
      failureCondition: function () {
        var avatarBottom = Flappy.avatarY + AVATAR_HEIGHT;
        var ground = Flappy.MAZE_HEIGHT - Flappy.GROUND_HEIGHT;
        return (avatarBottom >= ground && Flappy.gameState === Flappy.GameStates.ACTIVE);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + playSoundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1)
  },

  '3': {
    'requiredBlocks': [
      [{'test': 'setSpeed', 'type': 'flappy_setSpeed'}]
    ],
    'obstacles': false,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 400 - 55,
      startY: 0,
      moving: true,
      successCondition: function () {
        var avatarCenter = {
          x: (Flappy.avatarX + AVATAR_WIDTH) / 2,
          y: (Flappy.avatarY + AVATAR_HEIGHT) / 2
        };
        var goalCenter = {
          x: (Flappy.goalX + Flappy.GOAL_SIZE) / 2,
          y: (Flappy.goalY + Flappy.GOAL_SIZE) / 2
        };

        var diff = {
          x: Math.abs(avatarCenter.x - goalCenter.x),
          y: Math.abs(avatarCenter.y - goalCenter.y)
        };

        return diff.x < 15 && diff.y < 15;
      },
      failureCondition: function () {
        return Flappy.activeTicks() >= 120 && Flappy.SPEED === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2)
  },

  '4': {
    'requiredBlocks': [
      [{'test': 'endGame', 'type': 'flappy_endGame'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': false,
    'freePlay': false,
    'goal': {
      startX: 600 - (56 / 2),
      startY: 400 - 48 - 56 / 2,
      moving: true,
      successCondition: function () {
        return Flappy.obstacles[0].hitAvatar &&
          Flappy.gameState === Flappy.GameStates.OVER;
      },
      failureCondition: function () {
        // todo - would be nice if we could distinguish feedback for
        // flew through pipe vs. didnt hook up endGame block
        var obstacleEnd = Flappy.obstacles[0].x + Flappy.OBSTACLE_WIDTH;
        return obstacleEnd < Flappy.avatarX;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', 20, 20, flapBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2)
  },

  '5': {
    'requiredBlocks': [
      [{'test': 'incrementPlayerScore', 'type': 'flappy_incrementPlayerScore'}]
    ],
    'defaultFlap': 'SMALL',
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      // todo - kind of ugly that we end up loopin through all obstacles twice,
      // once to check for success and again to check for failure
      successCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (!obstacle.hitAvatar && obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore > 0;
      },
      failureCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (!obstacle.hitAvatar && obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapBlock + endGameBlock + incrementScoreBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapBlock) +
      // eventBlock('flappy_whenCollideGround', COL1, ROW2, endGameBlock) +
      // eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW1) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '6': {
    'requiredBlocks': [
      [{'test': 'flap', 'type': 'flappy_flap_height'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore > 0;
      },
      failureCondition: function () {
        var insideObstacle = false;
        Flappy.obstacles.forEach(function (obstacle) {
          if (obstacle.containsAvatar()) {
            insideObstacle = true;
          }
        });
        return insideObstacle && Flappy.playerScore === 0;
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock + setSpeedBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1) +
      // eventBlock('flappy_whenCollideGround', COL1, ROW2, endGameBlock) +
      // eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW1, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '7': {
    'requiredBlocks': [
      [{'test': 'setBackground', 'type': 'flappy_setBackground'}]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        return (Flappy.gameState === Flappy.GameStates.OVER);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock +
        setSpeedBlock + setBackgroundBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapHeightBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1, endGameBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '8': {
    'requiredBlocks': [
      [{
        test: function (block) {
          return (block.type === 'flappy_setBackground' ||
            block.type === 'flappy_setPlayer') &&
            block.getTitleValue('VALUE') === 'random';
        },
        type: 'flappy_setBackground',
        titles: {
          'VALUE': 'random'
        }
      }]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        return (Flappy.gameState === Flappy.GameStates.OVER);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock +
        setSpeedBlock + setBackgroundBlock + setPlayerBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapHeightBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1, endGameBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2, endGameBlock) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '9': {
    'requiredBlocks': [
      [{
        test: function (block) {
          return block.type === 'flappy_setScore';
        },
        type: 'flappy_setScore'
      }]
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': false,
    'goal': {
      successCondition: function () {
        return (Flappy.gameState === Flappy.GameStates.OVER);
      }
    },
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(flapHeightBlock + endGameBlock + incrementScoreBlock + playSoundBlock +
        setSpeedBlock + setBackgroundBlock + setPlayerBlock + setScoreBlock),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1, flapHeightBlock) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1, endGameBlock) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3, incrementScoreBlock) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2, setSpeedBlock)
  },

  '11': {
    'requiredBlocks': [
    ],
    'obstacles': true,
    'ground': true,
    'score': true,
    'freePlay': true,
    'scale': {
      'snapRadius': 2
    },
    'toolbox':
      tb(
        flapHeightBlock +
        playSoundBlock +
        incrementScoreBlock +
        endGameBlock +
        setSpeedBlock +
        setBackgroundBlock +
        setPlayerBlock +
        setObstacleBlock +
        setGroundBlock +
        setGapHeightBlock +
        setGravityBlock +
        setScoreBlock
      ),
    'startBlocks':
      eventBlock('flappy_whenClick', COL1, ROW1) +
      eventBlock('flappy_whenCollideGround', COL2, ROW1) +
      eventBlock('flappy_whenCollideObstacle', COL2, ROW2) +
      eventBlock('flappy_whenEnterObstacle', COL2, ROW3) +
      eventBlock('flappy_whenRunButtonClick', COL1, ROW2)
  }
};

},{"../block_utils":3,"./constants":11}],15:[function(require,module,exports){
(function (global){
var appMain = require('../appMain');
window.Flappy = require('./flappy');
if (typeof global !== 'undefined') {
  global.Flappy = window.Flappy;
}
var blocks = require('./blocks');
var levels = require('./levels');
var skins = require('./skins');

window.flappyMain = function(options) {
  options.skinsModule = skins;
  options.blocksModule = blocks;
  appMain(window.Flappy, levels, options);
};

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../appMain":1,"./blocks":10,"./flappy":13,"./levels":14,"./skins":16}],16:[function(require,module,exports){
/**
 * Load Skin for Flappy.
 */
// background: Number of 400x400 background images. Randomly select one if
// specified, otherwise, use background.png.
// graph: Colour of optional grid lines, or false.

var skinsBase = require('../skins');

var CONFIGS = {

  flappy: {
  }

};

exports.load = function(assetUrl, id) {
  var skin = skinsBase.load(assetUrl, id);
  var config = CONFIGS[skin.id];

  // todo: the way these are organized ends up being a little bit ugly as
  // lot of our assets are individual items not necessarily attached to a
  // specific theme

  skin.scifi = {
    background: skin.assetUrl('background_scifi.png'),
    avatar: skin.assetUrl('avatar_scifi.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_scifi.png'),
    obstacle_top: skin.assetUrl('obstacle_top_scifi.png'),
    ground: skin.assetUrl('ground_scifi.png')
  };

  skin.underwater = {
    background: skin.assetUrl('background_underwater.png'),
    avatar: skin.assetUrl('avatar_underwater.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_underwater.png'),
    obstacle_top: skin.assetUrl('obstacle_top_underwater.png'),
    ground: skin.assetUrl('ground_underwater.png')
  };

  skin.cave = {
    background: skin.assetUrl('background_cave.png'),
    avatar: skin.assetUrl('avatar_cave.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_cave.png'),
    obstacle_top: skin.assetUrl('obstacle_top_cave.png'),
    ground: skin.assetUrl('ground_cave.png')
  };

  skin.santa = {
    background: skin.assetUrl('background_santa.png'),
    avatar: skin.assetUrl('santa.png'),
    obstacle_bottom: skin.assetUrl('obstacle_bottom_santa.png'),
    obstacle_top: skin.assetUrl('obstacle_top_santa.png'),
    ground: skin.assetUrl('ground_santa.png')
  };

  skin.night = {
    background: skin.assetUrl('background_night.png')
  };

  skin.redbird = {
    avatar: skin.assetUrl('avatar_redbird.png')
  };

  skin.laser = {
    obstacle_bottom: skin.assetUrl('obstacle_bottom_laser.png'),
    obstacle_top: skin.assetUrl('obstacle_top_laser.png')
  };

  skin.lava = {
    ground: skin.assetUrl('ground_lava.png')
  };

  skin.shark = {
    avatar: skin.assetUrl('shark.png')
  };

  skin.easter = {
    avatar: skin.assetUrl('easterbunny.png')
  };

  skin.batman = {
    avatar: skin.assetUrl('batman.png')
  };

  skin.submarine = {
    avatar: skin.assetUrl('submarine.png')
  };

  skin.unicorn = {
    avatar: skin.assetUrl('unicorn.png')
  };

  skin.fairy = {
    avatar: skin.assetUrl('fairy.png')
  };

  skin.superman = {
    avatar: skin.assetUrl('superman.png')
  };

  skin.turkey = {
    avatar: skin.assetUrl('turkey.png')
  };

  // Images
  skin.ground = skin.assetUrl('ground.png');
  skin.obstacle_top = skin.assetUrl('obstacle_top.png');
  skin.obstacle_bottom = skin.assetUrl('obstacle_bottom.png');
  skin.instructions = skin.assetUrl('instructions.png');
  skin.clickrun = skin.assetUrl('clickrun.png');
  skin.getready = skin.assetUrl('getready.png');
  skin.gameover = skin.assetUrl('gameover.png');

  skin.tiles = skin.assetUrl('tiles.png');
  skin.goal = skin.assetUrl('goal.png');
  skin.goalSuccess = skin.assetUrl('goal_success.png');
  skin.goalAnimation = skin.assetUrl('goal.gif');
  skin.obstacle = skin.assetUrl('obstacle.png');
  skin.obstacleAnimation = skin.assetUrl('obstacle.gif');
  skin.obstacleScale = config.obstacleScale || 1.0;
  skin.largerObstacleAnimationTiles =
      skin.assetUrl(config.largerObstacleAnimationTiles);
  skin.hittingWallAnimation =
      skin.assetUrl(config.hittingWallAnimation);
  skin.approachingGoalAnimation =
      skin.assetUrl(config.approachingGoalAnimation);
  // Sounds
  skin.obstacleSound =
      [skin.assetUrl('obstacle.mp3'), skin.assetUrl('obstacle.ogg')];
  skin.wallSound = [skin.assetUrl('wall.mp3'), skin.assetUrl('wall.ogg')];
  skin.winGoalSound = [skin.assetUrl('win_goal.mp3'),
                       skin.assetUrl('win_goal.ogg')];
  skin.wall0Sound = [skin.assetUrl('wall0.mp3'), skin.assetUrl('wall0.ogg')];

  skin.dieSound = [skin.assetUrl('sfx_die.mp3'), skin.assetUrl('sfx_die.ogg')];
  skin.hitSound = [skin.assetUrl('sfx_hit.mp3'), skin.assetUrl('sfx_hit.ogg')];
  skin.pointSound = [skin.assetUrl('sfx_point.mp3'), skin.assetUrl('sfx_point.ogg')];
  skin.swooshingSound = [skin.assetUrl('sfx_swooshing.mp3'), skin.assetUrl('sfx_swooshing.ogg')];
  skin.wingSound = [skin.assetUrl('sfx_wing.mp3'), skin.assetUrl('sfx_wing.ogg')];

  skin.jetSound = [skin.assetUrl('jet.mp3'), skin.assetUrl('jet.ogg')];
  skin.crashSound = [skin.assetUrl('crash.mp3'), skin.assetUrl('crash.ogg')];
  skin.jingleSound = [skin.assetUrl('jingle.mp3'), skin.assetUrl('jingle.ogg')];
  skin.laserSound = [skin.assetUrl('laser.mp3'), skin.assetUrl('laser.ogg')];
  skin.splashSound = [skin.assetUrl('splash.mp3'), skin.assetUrl('splash.ogg')];

  // Settings
  skin.graph = config.graph;
  skin.background = skin.assetUrl('background.png');

  return skin;
};

},{"../skins":18}],17:[function(require,module,exports){
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
 buf.push('<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="svgFlappy">\n</svg>\n<div id="capacityBubble">\n  <div id="capacity"></div>\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"ejs":35}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
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

},{}],20:[function(require,module,exports){
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
},{"ejs":35}],21:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common'); ; buf.push('\n\n');3; if (data.ok) {; buf.push('  <div class="farSide" style="padding: 1ex 3ex 0">\n    <button id="ok-button" class="secondary">\n      ', escape((5,  msg.dialogOK() )), '\n    </button>\n  </div>\n');8; }; buf.push('\n');9; if (data.previousLevel) {; buf.push('  <button id="back-button" class="launch">\n    ', escape((10,  msg.backToPreviousLevel() )), '\n  </button>\n');12; }; buf.push('\n');13; if (data.tryAgain) {; buf.push('  <button id="again-button" class="launch">\n    ', escape((14,  msg.tryAgain() )), '\n  </button>\n');16; }; buf.push('\n');17; if (data.nextLevel) {; buf.push('  <button id="continue-button" class="launch">\n    ', escape((18,  msg.continue() )), '\n  </button>\n');20; }; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],22:[function(require,module,exports){
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
},{"ejs":35}],23:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common'); ; buf.push('\n\n<p class=\'dialog-title\'>', escape((3,  msg.puzzleTitle(locals) )), '</p>\n');4; if (locals.instructionImageUrl) {; buf.push('  <img class=\'instruction-image\' src=\'', escape((4,  locals.instructionImageUrl )), '\'>\n  <p class=\'instruction-with-image\'>', escape((5,  instructions )), '</p>\n');6; } else {; buf.push('  <p>', escape((6,  instructions )), '</p>\n');7; };; buf.push(''); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],24:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common') ; buf.push('\n\n');3; var root = location.protocol + '//' + location.host.replace('learn\.', ''); 
; buf.push('\n\n<div id="learn">\n\n  <h1><a href="', escape((7,  root )), '">', escape((7,  msg.wantToLearn() )), '</a></h1>\n  <a href="', escape((8,  root )), '"><img id="learn-to-code" src="', escape((8,  BlocklyApps.assetUrl('media/promo.png') )), '"></a>\n  <a href="', escape((9,  root )), '">', escape((9,  msg.watchVideo() )), '</a>\n  <a href="', escape((10,  root )), '">', escape((10,  msg.tryHOC() )), '</a>\n  <a href="', escape((11,  location.protocol + '//' + location.host 
)), '">', escape((11,  msg.signup() )), '</a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],25:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common') ; buf.push('\n\n<div id="make-your-own">\n\n  <h1><a href=', escape((5,  data.makeUrl )), '>', escape((5,  data.makeString )), '</a></h1>\n  <a href=', escape((6,  data.makeUrl )), '><img src=', escape((6,  data.makeImage )), '></a>\n\n</div>\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],26:[function(require,module,exports){
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
  var msg = require('../../locale/it_it/common');
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
},{"../../locale/it_it/common":33,"ejs":35}],27:[function(require,module,exports){
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
},{"ejs":35}],28:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common'); ; buf.push('\n');2; if (options.feedbackImage) { ; buf.push('\n  <div class="sharing-image">\n    <img class="feedback-image" src="', escape((4,  options.feedbackImage )), '">\n  </div>\n');6; } ; buf.push('\n\n<div class="sharing">\n');9; if (options.alreadySaved) { ; buf.push('\n  <div class="saved-to-gallery">\n    ', escape((11,  msg.savedToGallery() )), '\n  </div>\n');13; } else if (options.saveToGalleryUrl) { ; buf.push('\n  <div class="social-buttons">\n  <button id="save-to-gallery-button" class="launch">\n    ', escape((16,  msg.saveToGallery() )), '\n  </button>\n  </div>\n');19; } ; buf.push('\n\n');21; if (options.response && options.response.level_source) { ; buf.push('\n  ');22; if (options.appStrings && options.appStrings.sharingText) { ; buf.push('\n    <div>', escape((23,  options.appStrings.sharingText )), '</div>\n  ');24; } ; buf.push('\n\n  <div>\n    <input type="text" id="sharing-input" value=', escape((27,  options.response.level_source )), ' readonly>\n  </div>\n\n  <div class=\'social-buttons\'>\n    ');31; if (options.facebookUrl) {; buf.push('      <a href=', escape((31,  options.facebookUrl )), ' target="_blank">\n        <img src=', escape((32,  BlocklyApps.assetUrl("media/facebook_purple.png") )), '>\n      </a>\n    ');34; }; buf.push('  \n    ');35; if (options.twitterUrl) {; buf.push('      <a href=', escape((35,  options.twitterUrl )), ' target="_blank">\n        <img src=', escape((36,  BlocklyApps.assetUrl("media/twitter_purple.png") )), ' >\n      </a>\n    ');38; }; buf.push('  </div>\n');39; } ; buf.push('\n</div>\n\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],29:[function(require,module,exports){
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
 buf.push('');1; var msg = require('../../locale/it_it/common'); ; buf.push('\n\n<p id="num-lines-of-code" class="lines-of-code-message">\n  ', escape((4,  msg.numLinesOfCodeWritten({ numLines: numLinesWritten }) )), '\n  <button id="show-code-button" href="#">\n    ', escape((6,  msg.showGeneratedCode() )), '\n  </button>\n</p>\n\n');10; if (totalNumLinesWritten !== 0) { ; buf.push('\n  <p id="total-num-lines-of-code" class="lines-of-code-message">\n    ', escape((12,  msg.totalNumLinesOfCodeWritten({ numLines: totalNumLinesWritten }) )), '\n  </p>\n');14; } ; buf.push('\n'); })();
} 
return buf.join('');
};
  return function(locals) {
    return t(locals, require("ejs").filters);
  }
}());
},{"../../locale/it_it/common":33,"ejs":35}],30:[function(require,module,exports){
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
},{"ejs":35}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.it=function(n){return n===1?"one":"other"}
exports.blocklyMessage = function(d){return "Blockly"};

exports.catActions = function(d){return "Azioni"};

exports.catColour = function(d){return "Colore"};

exports.catLogic = function(d){return "Logica"};

exports.catLists = function(d){return "Liste"};

exports.catLoops = function(d){return "Ripetizioni"};

exports.catMath = function(d){return "Matematica"};

exports.catProcedures = function(d){return "Funzioni"};

exports.catText = function(d){return "Testo"};

exports.catVariables = function(d){return "Variabili"};

exports.codeTooltip = function(d){return "Guarda il codice JavaScript generato."};

exports.continue = function(d){return "Prosegui"};

exports.dialogCancel = function(d){return "Annulla"};

exports.dialogOK = function(d){return "Ok"};

exports.directionNorthLetter = function(d){return "N"};

exports.directionSouthLetter = function(d){return "S"};

exports.directionEastLetter = function(d){return "E"};

exports.directionWestLetter = function(d){return "W"};

exports.emptyBlocksErrorMsg = function(d){return "Il blocco \"ripeti\" o \"se\" deve avere all'interno altri blocchi per poter funzionare. Assicurati che i blocchi interni siano inseriti correttamente all'interno del blocco principale."};

exports.extraTopBlocks = function(d){return "Ci sono blocchi che non sono attaccati ad un blocco evento."};

exports.finalStage = function(d){return "Complimenti! Hai completato l'ultima lezione."};

exports.finalStageTrophies = function(d){return "Complimenti! Hai completato l'ultima lezione e vinto "+p(d,"numTrophies",0,"it",{"one":"un trofeo","other":n(d,"numTrophies")+" trofei"})+"."};

exports.generatedCodeInfo = function(d){return "I blocchi per il tuo programma possono essere rappresentati anche in JavaScript, uno dei linguaggi di programmazione più usati al mondo:"};

exports.hashError = function(d){return "Siamo spiacenti, '%1' non corrisponde ad alcun programma salvato."};

exports.help = function(d){return "Aiuto"};

exports.hintTitle = function(d){return "Suggerimento:"};

exports.jump = function(d){return "jump"};

exports.levelIncompleteError = function(d){return "Stai usando tutti i tipi di blocchi necessari, ma non nel modo giusto."};

exports.listVariable = function(d){return "lista"};

exports.makeYourOwnFlappy = function(d){return "Costruisci il tuo gioco Flappy"};

exports.missingBlocksErrorMsg = function(d){return "Prova uno o più dei blocchi che trovi qui sotto per risolvere questo puzzle."};

exports.nextLevel = function(d){return "Complimenti! Hai completato il puzzle "+v(d,"puzzleNumber")+"."};

exports.nextLevelTrophies = function(d){return "Complimenti! Hai completato il Puzzle "+v(d,"puzzleNumber")+" e vinto "+p(d,"numTrophies",0,"it",{"one":"un trofeo","other":n(d,"numTrophies")+" trofei"})+"."};

exports.nextStage = function(d){return "Complimenti! Hai completato la lezione "+v(d,"stageNumber")+"."};

exports.nextStageTrophies = function(d){return "Complimenti! Hai completato la lezione "+v(d,"stageNumber")+" e vinto "+p(d,"numTrophies",0,"it",{"one":"un trofeo","other":n(d,"numTrophies")+" trofei"})+"."};

exports.numBlocksNeeded = function(d){return "Complimenti! Hai completato il Puzzle "+v(d,"puzzleNumber")+". (Avresti però potuto usare solo "+p(d,"numBlocks",0,"it",{"one":"1 blocco","other":n(d,"numBlocks")+" blocchi"})+".)"};

exports.numLinesOfCodeWritten = function(d){return "Hai appena scritto "+p(d,"numLines",0,"it",{"one":"1 linea","other":n(d,"numLines")+" linee"})+" di codice!"};

exports.puzzleTitle = function(d){return "Puzzle "+v(d,"puzzle_number")+" di "+v(d,"stage_total")};

exports.resetProgram = function(d){return "Ricomincia"};

exports.runProgram = function(d){return "Esegui il programma"};

exports.runTooltip = function(d){return "Esegui il programma definito dai blocchi nell'area di lavoro."};

exports.showCodeHeader = function(d){return "Mostra il codice"};

exports.showGeneratedCode = function(d){return "Mostra il codice"};

exports.subtitle = function(d){return "un ambiente di programmazione visuale"};

exports.textVariable = function(d){return "testo"};

exports.tooFewBlocksMsg = function(d){return "Stai usando tutti i tipi di blocchi necessari, ma prova usando più blocchi o usandoli diversamente."};

exports.tooManyBlocksMsg = function(d){return "Questo puzzle può essere risolto con < x id= 'START_SPAN'/><x id='END_SPAN'/> blocchi."};

exports.tooMuchWork = function(d){return "Mi hai fatto fare un sacco di lavoro!  Puoi provare a farmi fare meno ripetizioni?"};

exports.flappySpecificFail = function(d){return "Il tuo codice sembra buono: Flappy sbatte le ali ad ogni clic. Ma devi cliccare molte volte per volare fino al bersaglio disegnato."};

exports.toolboxHeader = function(d){return "Blocchi"};

exports.openWorkspace = function(d){return "Come funziona"};

exports.totalNumLinesOfCodeWritten = function(d){return "Totale complessivo: "+p(d,"numLines",0,"it",{"one":"1 linea","other":n(d,"numLines")+" linee"})+" di codice."};

exports.tryAgain = function(d){return "Riprova"};

exports.backToPreviousLevel = function(d){return "Torna al livello precedente"};

exports.saveToGallery = function(d){return "Save to your gallery"};

exports.savedToGallery = function(d){return "Saved to your gallery!"};

exports.typeCode = function(d){return "Digita il tuo codice JavaScript sotto queste istruzioni."};

exports.typeFuncs = function(d){return "Funzioni disponibili: %1"};

exports.typeHint = function(d){return "Sono necessarie le parentesi e i punto e virgola."};

exports.workspaceHeader = function(d){return "Assembla i tuoi blocchi qui: "};

exports.infinity = function(d){return "Infinito"};

exports.rotateText = function(d){return "Ruota il dispositivo."};

exports.orientationLock = function(d){return "Disattiva il blocco dell'orientamento nelle impostazioni del dispositivo."};

exports.wantToLearn = function(d){return "Vuoi imparare a programmare?"};

exports.watchVideo = function(d){return "Guarda il video"};

exports.tryHOC = function(d){return "Prova l'Ora di Codice"};

exports.signup = function(d){return "Iscriviti al corso introduttivo"};

exports.hintHeader = function(d){return "Here's a tip:"};


},{"messageformat":46}],34:[function(require,module,exports){
var MessageFormat = require("messageformat");MessageFormat.locale.it=function(n){return n===1?"one":"other"}
exports.continue = function(d){return "Continua"};

exports.doCode = function(d){return "esegui"};

exports.elseCode = function(d){return "altrimenti"};

exports.endGame = function(d){return "fine del gioco"};

exports.endGameTooltip = function(d){return "Termina il gioco."};

exports.finalLevel = function(d){return "Complimenti! Hai risolto il puzzle finale."};

exports.flap = function(d){return "sbatti le ali"};

exports.flapRandom = function(d){return "sbatti le ali per un numero di volte scelto a caso"};

exports.flapVerySmall = function(d){return "sbatti le ali sbatti le ali per un numero di volte molto piccolo"};

exports.flapSmall = function(d){return "sbatti le ali per un numero di volte piccolo"};

exports.flapNormal = function(d){return "sbatti le ali per un numero di volte normale"};

exports.flapLarge = function(d){return "sbatti le ali per un numero di volte grande"};

exports.flapVeryLarge = function(d){return "sbatti le ali per un numero di volte molto grande"};

exports.flapTooltip = function(d){return "fai volare Flappy verso l'alto."};

exports.incrementPlayerScore = function(d){return "aggiungi un punto"};

exports.incrementPlayerScoreTooltip = function(d){return "Aggiunge uno al punteggio attuale del giocatore."};

exports.nextLevel = function(d){return "Complimenti! Hai completato questo puzzle."};

exports.no = function(d){return "No"};

exports.numBlocksNeeded = function(d){return "Questo puzzle può essere risolto con %1 blocchi."};

exports.oneTopBlock = function(d){return "Per questo puzzle, devi sovrapporre verticalmente tutti i blocchi nell'area di lavoro bianca."};

exports.playSoundRandom = function(d){return "riproduci un suono scelto a caso"};

exports.playSoundBounce = function(d){return "riproduci il suono di un rimbalzo"};

exports.playSoundCrunch = function(d){return "riproduci il suono di uno sgranocchiamento"};

exports.playSoundDie = function(d){return "riproduci un suono triste"};

exports.playSoundHit = function(d){return "riproduci il suono di uno schiacciamento"};

exports.playSoundPoint = function(d){return "riproduci il suono di un punto"};

exports.playSoundSwoosh = function(d){return "riproduci il suono di un risucchio"};

exports.playSoundWing = function(d){return "riproduci il suono di un'ala"};

exports.playSoundJet = function(d){return "riproduci il suono di un aereo a reazione"};

exports.playSoundCrash = function(d){return "riproduci il suono di qualcosa che si rompe"};

exports.playSoundJingle = function(d){return "riproduci il suono di un tintinnio"};

exports.playSoundSplash = function(d){return "riproduci il suono di un tuffo nell'acqua"};

exports.playSoundLaser = function(d){return "riproduci il suono di un raggio laser"};

exports.playSoundTooltip = function(d){return "Riproduci il suono scelto."};

exports.reinfFeedbackMsg = function(d){return "Premi \"Ricomincia\" per ricominciare a giocare la tua partita."};

exports.scoreText = function(d){return "Punteggio: "+v(d,"playerScore")};

exports.setBackgroundRandom = function(d){return "imposta una scena scelta a caso"};

exports.setBackgroundFlappy = function(d){return "impostare la scena Città di giorno"};

exports.setBackgroundNight = function(d){return "impostare la scena Città di notte"};

exports.setBackgroundSciFi = function(d){return "imposta la scena Fantascienza"};

exports.setBackgroundUnderwater = function(d){return "imposta la scena Sottomarina"};

exports.setBackgroundCave = function(d){return "imposta la scena Grotta"};

exports.setBackgroundSanta = function(d){return "imposta la scena Natale"};

exports.setBackgroundTooltip = function(d){return "Imposta l'immagine di sfondo"};

exports.setGapRandom = function(d){return "imposta una distanza casuale"};

exports.setGapVerySmall = function(d){return "imposta una distanza molto piccola"};

exports.setGapSmall = function(d){return "imposta una distanza piccola"};

exports.setGapNormal = function(d){return "imposta una distanza normale"};

exports.setGapLarge = function(d){return "imposta una distanza grande"};

exports.setGapVeryLarge = function(d){return "imposta una distanza molto grande"};

exports.setGapHeightTooltip = function(d){return "Imposta la distanza verticale in un ostacolo"};

exports.setGravityRandom = function(d){return "imposta una gravità scelta a caso"};

exports.setGravityVeryLow = function(d){return "imposta la gravità molto bassa"};

exports.setGravityLow = function(d){return "imposta la gravità bassa"};

exports.setGravityNormal = function(d){return "imposta la gravità normale"};

exports.setGravityHigh = function(d){return "imposta la gravità alta"};

exports.setGravityVeryHigh = function(d){return "imposta la gravità molto alta"};

exports.setGravityTooltip = function(d){return "Imposta il livello della gravità"};

exports.setGroundRandom = function(d){return "imposta un terreno scelto a caso"};

exports.setGroundFlappy = function(d){return "impostare il terreno Normale"};

exports.setGroundSciFi = function(d){return "imposta il terreno Fantascienza"};

exports.setGroundUnderwater = function(d){return "imposta il terreno Sottomarino"};

exports.setGroundCave = function(d){return "imposta il terreno Grotta"};

exports.setGroundSanta = function(d){return "Imposta il terreno Natale"};

exports.setGroundLava = function(d){return "imposta il terreno Lava"};

exports.setGroundTooltip = function(d){return "Imposta l'immagine del terreno"};

exports.setObstacleRandom = function(d){return "imposta un ostacolo scelto a caso"};

exports.setObstacleFlappy = function(d){return "imposta l'ostacolo Tubo"};

exports.setObstacleSciFi = function(d){return "imposta l'ostacolo Fantascienza"};

exports.setObstacleUnderwater = function(d){return "imposta l'ostacolo Pianta"};

exports.setObstacleCave = function(d){return "imposta l'ostacolo Grotta"};

exports.setObstacleSanta = function(d){return "imposta l'ostacolo Camino"};

exports.setObstacleLaser = function(d){return "imposta l'ostacolo Raggio Laser"};

exports.setObstacleTooltip = function(d){return "Imposta l'immagine degli ostacoli"};

exports.setPlayerRandom = function(d){return "imposta un giocatore scelto a caso"};

exports.setPlayerFlappy = function(d){return "imposta il giocatore Uccello Giallo"};

exports.setPlayerRedBird = function(d){return "imposta il giocatore Uccello Rosso"};

exports.setPlayerSciFi = function(d){return "imposta il giocatore Astronave"};

exports.setPlayerUnderwater = function(d){return "imposta il giocatore Pesce"};

exports.setPlayerCave = function(d){return "imposta il giocatore Pipistrello"};

exports.setPlayerSanta = function(d){return "imposta il giocatore Babbo Natale"};

exports.setPlayerShark = function(d){return "imposta il giocatore Squalo"};

exports.setPlayerEaster = function(d){return "imposta il giocatore Coniglietto"};

exports.setPlayerBatman = function(d){return "imposta il giocatore Batman"};

exports.setPlayerSubmarine = function(d){return "imposta il giocatore Sottomarino"};

exports.setPlayerUnicorn = function(d){return "imposta il giocatore Unicorno"};

exports.setPlayerFairy = function(d){return "imposta il giocatore Fatina"};

exports.setPlayerSuperman = function(d){return "imposta il giocatore Superman"};

exports.setPlayerTurkey = function(d){return "imposta il giocatore Tacchino"};

exports.setPlayerTooltip = function(d){return "Imposta l'immagine del giocatore"};

exports.setScore = function(d){return "imposta il punteggio"};

exports.setScoreTooltip = function(d){return "Imposta il punteggio del giocatore"};

exports.setSpeed = function(d){return "Imposta una velocità"};

exports.setSpeedTooltip = function(d){return "Imposta la velocità con cui Flappy sbatte le ali"};

exports.share = function(d){return "Condividi"};

exports.shareFlappyTwitter = function(d){return "Guarda il gioco Flappy che ho creato io. L'ho fatto da solo @codeorg"};

exports.shareGame = function(d){return "Condividi il tuo gioco:"};

exports.speedRandom = function(d){return "imposta una velocità scelta a caso"};

exports.speedVerySlow = function(d){return "imposta una velocità molto lenta"};

exports.speedSlow = function(d){return "imposta una velocità lenta"};

exports.speedNormal = function(d){return "imposta una velocità normale"};

exports.speedFast = function(d){return "imposta una velocità veloce"};

exports.speedVeryFast = function(d){return "imposta una velocità molto veloce"};

exports.whenClick = function(d){return "quando si clicca"};

exports.whenClickTooltip = function(d){return "Esegue le azioni qua sotto quando si verifica l'evento \"clic\"."};

exports.whenCollideGround = function(d){return "quando precipita a terra"};

exports.whenCollideGroundTooltip = function(d){return "Esegue le azioni qua sotto quando Flappy precipita a terra."};

exports.whenCollideObstacle = function(d){return "quando colpisce un ostacolo"};

exports.whenCollideObstacleTooltip = function(d){return "Esegue le azioni qua sotto quando Flappy colpisce un ostacolo."};

exports.whenEnterObstacle = function(d){return "quando supera un ostacolo"};

exports.whenEnterObstacleTooltip = function(d){return "Esegue le azioni qua sotto quando Flappy incontra un ostacolo."};

exports.whenRunButtonClick = function(d){return "quando si clicca su \"Esegui il programma\""};

exports.whenRunButtonClickTooltip = function(d){return "Esegue le azioni qua sotto quando si clicca su \"Esegui il programma\"."};

exports.yes = function(d){return "Sì"};


},{"messageformat":46}],35:[function(require,module,exports){

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

},{"./filters":36,"./utils":37,"fs":38,"path":40}],36:[function(require,module,exports){
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

},{}],37:[function(require,module,exports){

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
 

},{}],38:[function(require,module,exports){

},{}],39:[function(require,module,exports){
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

},{}],40:[function(require,module,exports){
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
},{"/home/ubuntu/website-ci/blockly/node_modules/grunt-browserify/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":39}],41:[function(require,module,exports){
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
},{}],42:[function(require,module,exports){
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

},{}],43:[function(require,module,exports){
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

},{}],44:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":42,"./encode":43}],45:[function(require,module,exports){
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

},{"punycode":41,"querystring":44}],46:[function(require,module,exports){
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

},{}]},{},[15])