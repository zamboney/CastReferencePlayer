/**
 * Copyright 2014 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Receiver / Player sample
 * <p>
 * This sample demonstrates how to build your own Receiver for use with Google
 * Cast. One of the goals of this sample is to be fully UX compliant.
 * </p>
 * <p>
 * A receiver is typically an HTML5 application with a html, css, and JavaScript
 * components. It demonstrates the following Cast Receiver API's:
 * </p>
 * <ul>
 * <li>CastReceiverManager</li>
 * <li>MediaManager</li>
 * <li>Media Player Library</li>
 * </ul>
 * <p>
 * It also demonstrates the following player functions:
 * </p>
 * <ul>
 * <li>Branding Screen</li>
 * <li>Playback Complete image</li>
 * <li>Limited Animation</li>
 * <li>Buffering Indicator</li>
 * <li>Seeking</li>
 * <li>Pause indicator</li>
 * <li>Loading Indicator</li>
 * </ul>
 *
 */

'use strict';


/**
 * Creates the namespace
 */
var sampleplayer = sampleplayer || {};



/**
 * <p>
 * Cast player constructor - This does the following:
 * </p>
 * <ol>
 * <li>Bind a listener to visibilitychange</li>
 * <li>Set the default state</li>
 * <li>Bind event listeners for img & video tags<br />
 *  error, stalled, waiting, playing, pause, ended, timeupdate, seeking, &
 *  seeked</li>
 * <li>Find and remember the various elements</li>
 * <li>Create the MediaManager and bind to onLoad & onStop</li>
 * </ol>
 *
 * @param {!Element} element the element to attach the player
 * @constructor
 * @export
 */
sampleplayer.CastPlayer = function(element) {

  /**
   * The debug setting to control receiver, MPL and player logging.
   * @private {boolean}
   */
  this.debug_ = sampleplayer.DISABLE_DEBUG_;
  if (this.debug_) {
    cast.player.api.setLoggerLevel(cast.player.api.LoggerLevel.DEBUG);
    cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.DEBUG);
  }

  /**
   * The DOM element the player is attached.
   * @private {!Element}
   */
  this.element_ = element;

  /**
   * The current type of the player.
   * @private {sampleplayer.Type}
   */
  this.type_;

  this.setType_(sampleplayer.Type.UNKNOWN, false);

  /**
   * The current state of the player.
   * @private {sampleplayer.State}
   */
  this.state_;

  this.setState_(sampleplayer.State.LAUNCHING, false);

  /**
   * The id returned by setTimeout for the idle timer
   * @private {number|undefined}
   */
  this.idleTimerId_;

  /**
   * The DOM element for the inner portion of the progress bar.
   * @private {!Element}
   */
  this.progressBarInnerElement_ = this.getElementByClass_(
      '.controls-progress-inner');

  /**
   * The DOM element for the thumb portion of the progress bar.
   * @private {!Element}
   */
  this.progressBarThumbElement_ = this.getElementByClass_(
      '.controls-progress-thumb');

  /**
   * The DOM element for the current time label.
   * @private {!Element}
   */
  this.curTimeElement_ = this.getElementByClass_('.controls-cur-time');

  /**
   * The DOM element for the total time label.
   * @private {!Element}
   */
  this.totalTimeElement_ = this.getElementByClass_('.controls-total-time');

  /**
   * Handler to defer playback of media until enough data is pumped.
   * @private {function()}
   */
  this.playerAutoPlayHandler_ = this.doPlayerAutoPlay_.bind(this);

  /**
   * Whether player app should handle autoplay behavior.
   * @private {boolean}
   */
  this.playerAutoPlay_ = false;

  /**
   * The media element.
   * @private {HTMLMediaElement}
   */
  this.mediaElement_ = /** @type {HTMLMediaElement} */
      (this.element_.querySelector('video'));
  this.mediaElement_.addEventListener('error', this.onError_.bind(this), false);
  this.mediaElement_.addEventListener('playing', this.onPlaying_.bind(this),
      false);
  this.mediaElement_.addEventListener('pause', this.onPause_.bind(this), false);
  this.mediaElement_.addEventListener('ended', this.onEnded_.bind(this), false);
  this.mediaElement_.addEventListener('timeupdate', this.onProgress_.bind(this),
      false);
  this.mediaElement_.addEventListener('seeking', this.onSeekStart_.bind(this),
      false);
  this.mediaElement_.addEventListener('seeked', this.onSeekEnd_.bind(this),
      false);
  this.mediaElement_.addEventListener('loadedmetadata',
      this.onLoadSuccess_.bind(this), false);

  /**
   * Id of autoplay timer.
   * @private {?number}
   */
  this.playerAutoPlayTimerId_ = null;


  /**
   * The cast receiver manager.
   * @private {!cast.receiver.CastReceiverManager}
   */
  this.receiverManager_ = cast.receiver.CastReceiverManager.getInstance();
  this.receiverManager_.onReady = this.onReady_.bind(this);
  this.receiverManager_.onSenderDisconnected =
      this.onSenderDisconnected_.bind(this);
  this.receiverManager_.onVisibilityChanged =
      this.onVisibilityChanged_.bind(this);
  this.receiverManager_.setApplicationState(
      sampleplayer.getApplicationState_());


  /**
   * The remote media object.
   * @private {cast.receiver.MediaManager}
   */
  this.mediaManager_ = new cast.receiver.MediaManager(this.mediaElement_);

  /**
   * The original load callback.
   * @private {?function(cast.receiver.MediaManager.Event)}
   */
  this.onLoadOrig_ =
      this.mediaManager_.onLoad.bind(this.mediaManager_);
  this.mediaManager_.onLoad = this.onLoad_.bind(this);

  /**
   * The original stop callback.
   * @private {?function(cast.receiver.MediaManager.Event)}
   */
  this.onStopOrig_ =
      this.mediaManager_.onStop.bind(this.mediaManager_);
  this.mediaManager_.onStop = this.onStop_.bind(this);

  /**
   * The original metadata error callback.
   * @private {?function(!cast.receiver.MediaManager.LoadInfo)}
   */
  this.onLoadMetadataErrorOrig_ =
      this.mediaManager_.onLoadMetadataError.bind(this.mediaManager_);
  this.mediaManager_.onLoadMetadataError = this.onLoadMetadataError_.bind(this);

  /**
   * The original error callback
   * @private {?function(!Object)}
   */
  this.onErrorOrig_ =
      this.mediaManager_.onError.bind(this.mediaManager_);
  this.mediaManager_.onError = this.onError_.bind(this);

  this.mediaManager_.customizedStatusCallback =
      this.customizedStatusCallback_.bind(this);
};


/**
 * The amount of time in a given state before the player goes idle.
 */
sampleplayer.IDLE_TIMEOUT = {
  LAUNCHING: 1000 * 60 * 5, // 5 minutes
  LOADING: 1000 * 60 * 5,  // 5 minutes
  PAUSED: 1000 * 60 * 20,  // 20 minutes
  STALLED: 30 * 1000,      // 30 seconds
  DONE: 1000 * 60 * 5,     // 5 minutes
  IDLE: 1000 * 60 * 5      // 5 minutes
};


/**
 * Describes the type of media being played.
 *
 * @enum {string}
 */
sampleplayer.Type = {
  VIDEO: 'video',
  UNKNOWN: 'unknown'
};


/**
 * Describes the state of the player.
 *
 * @enum {string}
 */
sampleplayer.State = {
  LAUNCHING: 'launching',
  LOADING: 'loading',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  PAUSED: 'paused',
  STALLED: 'stalled',
  DONE: 'done',
  IDLE: 'idle'
};


/**
 * The interval (in ms) of polling to check enough if data is pumped.
 *
 * @const @private {number}
 */
sampleplayer.PUMP_POLLING_INTERVAL_ = 200;


/**
 * The duration (in sec) of media to be pumped before playback starts.
 *
 * @const @private {number}
 */
sampleplayer.INITIAL_PUMP_DURATION_ = 5.0;


/**
 * The minimum duration (in ms) that media is displayed.
 *
 * @const @private {number}
 */
sampleplayer.MEDIA_INFO_DURATION_ = 2 * 1000;


/**
 * Transition animation duration (in sec).
 *
 * @const @private {number}
 */
sampleplayer.TRANSITION_DURATION_ = 1.5;


/**
 * Const to enable debugging.
 *
 * @const @private {boolean}
 */
sampleplayer.ENABLE_DEBUG_ = true;


/**
 * Const to disable debugging.
 *
 * #@const @private {boolean}
 */
sampleplayer.DISABLE_DEBUG_ = false;


/**
 * Returns the element with the given class name
 *
 * @param {string} className The class name of the element to return.
 * @return {!Element}
 * @throws {Error} If given class cannot be found.
 * @private
 */
sampleplayer.CastPlayer.prototype.getElementByClass_ = function(className) {
  var element = this.element_.querySelector(className);
  if (element) {
    return element;
  } else {
    throw Error('Cannot find element with class: ' + className);
  }
};


/**
 * Returns this player's media element.
 *
 * @return {HTMLMediaElement} The media element.
 * @export
 */
sampleplayer.CastPlayer.prototype.getMediaElement = function() {
  return this.mediaElement_;
};


/**
 * Returns this player's media manager.
 *
 * @return {cast.receiver.MediaManager} The media manager.
 * @export
 */
sampleplayer.CastPlayer.prototype.getMediaManager = function() {
  return this.mediaManager_;
};


/**
 * Starts the player.
 *
 * @export
 */
sampleplayer.CastPlayer.prototype.start = function() {
  this.receiverManager_.start();
};


/**
 * Loads the given data.
 *
 * @param {!cast.receiver.MediaManager.LoadInfo} info The load request info.
 * @export
 */
sampleplayer.CastPlayer.prototype.load = function(info) {
  this.log_('onLoad_');
  clearTimeout(this.idleTimerId_);
  var self = this;
  var media = info.message.media || {};
  var contentType = media.contentType;
  var playerType = sampleplayer.getType_(media);
  var isLiveStream = media.streamType === cast.receiver.media.StreamType.LIVE;
  if (!media.contentId) {
    this.log_('Load failed: no content');
    self.onLoadMetadataError_(info);
  } else if (playerType === sampleplayer.Type.UNKNOWN) {
    this.log_('Load failed: unknown content type: ' + contentType);
    self.onLoadMetadataError_(info);
  } else {
    this.log_('Loading: ' + playerType);
    var deferredLoadFunc = null;
    self.resetMediaElement_();
    self.setType_(playerType, isLiveStream);
    switch (playerType) {
      case sampleplayer.Type.VIDEO:
        self.loadVideo_(info);
        break;
    }

    sampleplayer.preload_(media, function() {
      sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
          function() {
            self.setState_(sampleplayer.State.LOADING, false);
            self.loadMetadata_(media);
            if (deferredLoadFunc) {
              deferredLoadFunc();
            }
          });
    });
  }
};


/**
 * Resets the media element.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.resetMediaElement_ = function() {
  this.log_('resetMediaElement_');
  if (this.player_) {
    this.player_.unload();
    this.player_ = null;
  }
};


/**
 * Loads the metadata for the given media.
 *
 * @param {!cast.receiver.media.MediaInformation} media The media.
 * @private
 */
sampleplayer.CastPlayer.prototype.loadMetadata_ = function(media) {
  this.log_('loadMetadata_');
  var metadata = media.metadata || {};
  var titleElement = this.element_.querySelector('.media-title');
  sampleplayer.setInnerText_(titleElement, metadata.title);

  var subtitleElement = this.element_.querySelector('.media-subtitle');
  sampleplayer.setInnerText_(subtitleElement, metadata['subtitle']);

  var artwork = sampleplayer.getMediaImageUrl_(media);
  var artworkElement = this.element_.querySelector('.media-artwork');
  sampleplayer.setBackgroundImage_(artworkElement, artwork);
};


/**
 * Loads some video content.
 *
 * @param {!cast.receiver.MediaManager.LoadInfo} info The load request info.
 * @private
 */
sampleplayer.CastPlayer.prototype.loadVideo_ = function(info) {
  this.log_('loadVideo_');
  var self = this;
  var protocolFunc = null;
  var autoplay = info.message.autoplay;
  var url = info.message.media.contentId;
  var type = info.message.media.contentType || '';
  var path = sampleplayer.getPath_(url);
  if (sampleplayer.getExtension_(path) === 'm3u8' ||
          type === 'application/x-mpegurl' ||
          type === 'application/vnd.apple.mpegurl') {
    protocolFunc = cast.player.api.CreateHlsStreamingProtocol;
  } else if (sampleplayer.getExtension_(path) === 'mpd' ||
          type === 'application/dash+xml') {
    protocolFunc = cast.player.api.CreateDashStreamingProtocol;
  } else if (path.indexOf('.ism') > -1 ||
          type === 'application/vnd.ms-sstr+xml') {
    protocolFunc = cast.player.api.CreateSmoothStreamingProtocol;
  }

  if (!protocolFunc) {
    this.log_('loadVideo_: using MediaElement');
    this.mediaElement_.addEventListener('stalled', this.onBuffering_.bind(this),
        false);
    this.mediaElement_.addEventListener('waiting', this.onBuffering_.bind(this),
        false);
    this.onLoadOrig_(new cast.receiver.MediaManager.Event(
        cast.receiver.MediaManager.EventType.LOAD,
        /** @type {!cast.receiver.MediaManager.RequestData} */ (info.message),
        info.senderId));
  } else {
    this.log_('loadVideo_: using Media Player Library');
    var host = new cast.player.api.Host({
      'url': url,
      'mediaElement': this.mediaElement_
    });
    host.onError = function() {
      // unload player and trigger error event on media element
      if (self.player_) {
        self.player_.unload();
        self.player_ = null;
        self.mediaElement_.dispatchEvent(new Event('error'));
      }
    };
    // When MPL is used, buffering status should be detected by
    // getState()['underflow]'
    this.mediaElement_.removeEventListener('stalled', this.onBuffering_);
    this.mediaElement_.removeEventListener('waiting', this.onBuffering_);

    // When MPL is used, player app should handle autoplay to make sure
    // that playback starts with enough data in buffer.
    this.mediaElement_.autoplay = false;
    this.playerAutoPlay_ = autoplay === undefined ? true : autoplay;

    this.player_ = new cast.player.api.Player(host);
    this.player_.load(protocolFunc(host));
  }
};


/**
 * Sets the amount of time before the player is considered idle.
 *
 * @param {number} t the time in milliseconds before the player goes idle
 * @private
 */
sampleplayer.CastPlayer.prototype.setIdleTimeout_ = function(t) {
  this.log_('setIdleTimeout_: ' + t);
  var self = this;
  clearTimeout(this.idleTimerId_);
  if (t) {
    this.idleTimerId_ = setTimeout(function() {
      self.receiverManager_.stop();
    }, t);
  }
};


/**
 * Sets the type of player.
 *
 * @param {sampleplayer.Type} type The type of player.
 * @param {boolean} isLiveStream whether player is showing live content
 * @private
 */
sampleplayer.CastPlayer.prototype.setType_ = function(type, isLiveStream) {
  this.log_('setType_: ' + type);
  this.type_ = type;
  this.element_.setAttribute('type', type);
  this.element_.setAttribute('live', isLiveStream.toString());
};


/**
 * Sets the state of the player.
 *
 * @param {sampleplayer.State} state the new state of the player
 * @param {boolean=} opt_crossfade true if should cross fade between states
 * @param {number=} opt_delay the amount of time (in ms) to wait
 * @private
 */
sampleplayer.CastPlayer.prototype.setState_ = function(
    state, opt_crossfade, opt_delay) {
  this.log_('setState_: state=' + state + ', crossfade=' + opt_crossfade +
      ', delay=' + opt_delay);
  var self = this;
  clearTimeout(self.delay_);
  if (opt_delay) {
    var func = function() { self.setState_(state, opt_crossfade); };
    self.delay_ = setTimeout(func, opt_delay);
  } else {
    if (!opt_crossfade) {
      self.state_ = state;
      self.element_.setAttribute('state', state);
      self.updateApplicationState_();
      self.setIdleTimeout_(sampleplayer.IDLE_TIMEOUT[state.toUpperCase()]);
    } else {
      sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
          function() {
            self.setState_(state, false);
          });
    }
  }
};


/**
 * Updates the application state if it has changed.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.updateApplicationState_ = function() {
  this.log_('updateApplicationState_');
  if (this.mediaManager_) {
    var idle = this.state_ === sampleplayer.State.IDLE;
    var media = idle ? null : this.mediaManager_.getMediaInformation();
    var applicationState = sampleplayer.getApplicationState_(media);
    if (this.applicationState_ != applicationState) {
      this.applicationState_ = applicationState;
      this.receiverManager_.setApplicationState(applicationState);
    }
  }
};


/**
 * Called when the player is ready. We initialize the UI for the launching
 * and idle screens.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onReady_ = function() {
  this.log_('onReady');
  this.setState_(sampleplayer.State.IDLE, false);
};


/**
 * Called when a sender disconnects from the app.
 *
 * @param {cast.receiver.CastReceiverManager.SenderDisconnectedEvent} event
 * @private
 */
sampleplayer.CastPlayer.prototype.onSenderDisconnected_ = function(event) {
  this.log_('onSenderDisconnected');
  // When the last or only sender is connected to a receiver,
  // tapping Disconnect stops the app running on the receiver.
  if (this.receiverManager_.getSenders().length === 0 &&
      event.reason ===
          cast.receiver.system.DisconnectReason.REQUESTED_BY_SENDER) {
    this.receiverManager_.stop();
  }
};


/**
 * Called when media has an error. Transitions to IDLE state and
 * calls to the original media manager implementation.
 *
 * @see cast.receiver.MediaManager#onError
 * @param {!Object} error
 * @private
 */
sampleplayer.CastPlayer.prototype.onError_ = function(error) {
  this.log_('onError');
  var self = this;
  sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(sampleplayer.State.IDLE, true);
        self.onErrorOrig_(error);
      });
};


/**
 * Called when media is buffering. If we were previously playing,
 * transition to the BUFFERING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onBuffering_ = function() {
  this.log_('onBuffering[readyState=' + this.mediaElement_.readyState + ']');
  if (this.state_ === sampleplayer.State.PLAYING &&
      this.mediaElement_.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
    this.setState_(sampleplayer.State.BUFFERING, false);
  }
};


/**
 * Called when media has started playing. We transition to the
 * PLAYING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onPlaying_ = function() {
  this.log_('onPlaying');
  this.cancelPlayerAutoPlay_();
  var isLoading = this.state_ === sampleplayer.State.LOADING;
  this.setState_(sampleplayer.State.PLAYING, isLoading);
};


/**
 * Called when media has been paused. If this is an auto-pause as a result of
 * buffer underflow, we transition to BUFFERING state; otherwise, if the media
 * isn't done, we transition to the PAUSED state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onPause_ = function() {
  this.log_('onPause');
  this.cancelPlayerAutoPlay_();
  var isIdle = this.state_ === sampleplayer.State.IDLE;
  var isDone = this.mediaElement_.currentTime === this.mediaElement_.duration;
  var isUnderflow = this.player_ && this.player_.getState()['underflow'];
  if (isUnderflow) {
    this.log_('isUnderflow');
    this.setState_(sampleplayer.State.BUFFERING, false);
    this.mediaManager_.broadcastStatus(/* includeMedia */ false);
  } else if (!isIdle && !isDone) {
    this.setState_(sampleplayer.State.PAUSED, false);
  }
  this.updateProgress_();
};


/**
 * Changes player state reported to sender, if necessary.
 * @param {!cast.receiver.media.MediaStatus} mediaStatus Media status that is
 *     supposed to go to sender.
 * @return {cast.receiver.media.MediaStatus} MediaStatus that will be sent to
 *     sender.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.customizedStatusCallback_ = function(
    mediaStatus) {
  this.log_('customizedStatusCallback_: playerState=' +
      mediaStatus.playerState + ', this.state_=' + this.state_);
  // TODO: remove this workaround once MediaManager detects buffering
  // immediately.
  if (mediaStatus.playerState === cast.receiver.media.PlayerState.PAUSED &&
      this.state_ === sampleplayer.State.BUFFERING) {
    mediaStatus.playerState = cast.receiver.media.PlayerState.BUFFERING;
  }
  return mediaStatus;
};


/**
 * Called when we receive a STOP message. We stop the media and transition
 * to the IDLE state.
 *
 * @param {cast.receiver.MediaManager.Event} event The stop event.
 * @private
 */
sampleplayer.CastPlayer.prototype.onStop_ = function(event) {
  this.log_('onStop');
  this.cancelPlayerAutoPlay_();
  var self = this;
  sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(sampleplayer.State.IDLE, false);
        self.onStopOrig_(event);
      });
};


/**
 * Called when media has ended. We transition to the IDLE state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onEnded_ = function() {
  this.log_('onEnded');
  this.setState_(sampleplayer.State.DONE, true);
};


/**
 * Called periodically during playback, to notify changes in playback position.
 * We transition to PLAYING state, if we were in BUFFERING or LOADING state.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onProgress_ = function() {
  // if we were previously buffering, update state to playing
  if (this.state_ === sampleplayer.State.BUFFERING ||
      this.state_ === sampleplayer.State.LOADING) {
    this.setState_(sampleplayer.State.PLAYING, false);
  }
  this.updateProgress_();
};


/**
 * Updates the current time and progress bar elements.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.updateProgress_ = function() {
  // Update the time and the progress bar
  var curTime = this.mediaElement_.currentTime;
  var totalTime = this.mediaElement_.duration;
  if (!isNaN(curTime) && !isNaN(totalTime)) {
    var pct = 100 * (curTime / totalTime);
    this.curTimeElement_.innerText = sampleplayer.formatDuration_(curTime);
    this.totalTimeElement_.innerText = sampleplayer.formatDuration_(totalTime);
    this.progressBarInnerElement_.style.width = pct + '%';
    this.progressBarThumbElement_.style.left = pct + '%';
  }
};


/**
 * Callback called when user starts seeking
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onSeekStart_ = function() {
  this.log_('onSeekStart');
  clearTimeout(this.seekingTimeoutId_);
  this.element_.classList.add('seeking');
};


/**
 * Callback called when user stops seeking.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onSeekEnd_ = function() {
  this.log_('onSeekEnd');
  clearTimeout(this.seekingTimeoutId_);
  this.seekingTimeoutId_ = sampleplayer.addClassWithTimeout_(this.element_,
      'seeking', 3000);
};


/**
 * Called when the player is added/removed from the screen because HDMI
 * input has changed. If we were playing but no longer visible, pause
 * the currently playing media.
 *
 * @see cast.receiver.CastReceiverManager#onVisibilityChanged
 * @param {!cast.receiver.CastReceiverManager.VisibilityChangedEvent} event
 *    Event fired when visibility of application is changed.
 * @private
 */
sampleplayer.CastPlayer.prototype.onVisibilityChanged_ = function(event) {
  this.log_('onVisibilityChanged');
  if (!event.isVisible) {
    this.mediaElement_.pause();
    this.mediaManager_.broadcastStatus(false);
  }
};


/**
 * Called when we receive a LOAD message. Calls load().
 *
 * @see sampleplayer#load
 * @param {cast.receiver.MediaManager.Event} event The load event.
 * @private
 */
sampleplayer.CastPlayer.prototype.onLoad_ = function(event) {
  this.log_('onLoad_');
  this.cancelPlayerAutoPlay_();
  this.load(new cast.receiver.MediaManager.LoadInfo(
      /** @type {!cast.receiver.MediaManager.LoadRequestData} */ (event.data),
      event.senderId));
};


/**
 * Called when the media could not be successfully loaded. Transitions to
 * IDLE state and calls the original media manager implementation.
 *
 * @see cast.receiver.MediaManager#onLoadMetadataError
 * @param {!cast.receiver.MediaManager.LoadInfo} event The data
 *     associated with a LOAD event.
 * @private
 */
sampleplayer.CastPlayer.prototype.onLoadMetadataError_ = function(event) {
  this.log_('onLoadMetadataError_');
  var self = this;
  sampleplayer.transition_(self.element_, sampleplayer.TRANSITION_DURATION_,
      function() {
        self.setState_(sampleplayer.State.IDLE, true);
        self.onLoadMetadataErrorOrig_(event);
      });
};


/**
 * Returns length of buffered duration from current media time.
 *
 * @return {number} Length of buffered duration in sec.
 * @private
 */
sampleplayer.CastPlayer.prototype.getBufferedDuration_ = function() {
  this.log_('getBufferedDuration_');
  var bufferedRanges = this.mediaElement_.buffered;
  var currentTime = this.mediaElement_.currentTime;
  var bufferedDuration = 0;
  for (var i = 0; bufferedRanges && i < bufferedRanges.length; i++) {
    if (bufferedRanges.start(i) <= currentTime &&
        bufferedRanges.end(i) > currentTime) {
      bufferedDuration = bufferedRanges.end(i) - currentTime;
      break;
    }
  }
  return bufferedDuration;
};


/**
 * Starts playback after enough data is buffered initially.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.doPlayerAutoPlay_ = function() {
  this.log_('doPlayerAutoPlay_');
  var mediaElement = this.mediaElement_;
  var bufferedDuration = this.getBufferedDuration_();
  var hasEnoughDataPumped =
      bufferedDuration >= sampleplayer.INITIAL_PUMP_DURATION_;
  if (hasEnoughDataPumped) {
    this.log_('Playback starts with initial buffer of ' +
        bufferedDuration.toFixed(2));
    mediaElement.play();
    this.playerAutoPlayTimerId_ = null;
  } else {
    this.playerAutoPlayTimerId_ = setTimeout(
        this.playerAutoPlayHandler_,
        sampleplayer.PUMP_POLLING_INTERVAL_);
  }
};


/**
 * Cancels autoplay handled by player.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.cancelPlayerAutoPlay_ = function() {
  this.log_('cancelPlayerAutoPlay_');
  if (this.playerAutoPlayTimerId_) {
    this.log_('Deferred playback is cancelled');
    clearTimeout(this.playerAutoPlayTimerId_);
    this.playerAutoPlayTimerId_ = null;
  }
};


/**
 * Called when the media is successfully loaded. Updates the progress bar
 * and starts playing the media if autoplay is set to true.
 *
 * @private
 */
sampleplayer.CastPlayer.prototype.onLoadSuccess_ = function() {
  this.log_('onLoadSuccess');
  // we should have total time at this point, so update the label
  // and progress bar
  var totalTime = this.mediaElement_.duration;
  if (!isNaN(totalTime)) {
    this.totalTimeElement_.textContent =
        sampleplayer.formatDuration_(totalTime);
  } else {
    this.totalTimeElement_.textContent = '';
    this.progressBarInnerElement_.style.width = '100%';
    this.progressBarThumbElement_.style.left = '100%';
  }

  // if we were set to autoplay, delay playback by a short amount of time
  if (this.player_ && this.playerAutoPlay_) {
    // Make sure media info displayed long enough before playback starts.
    var self = this;
    setTimeout(function() {
      if (!isNaN(totalTime) &&
          totalTime > sampleplayer.INITIAL_PUMP_DURATION_) {
        self.doPlayerAutoPlay_();
      } else {
        self.mediaElement_.play();
      }
    }, sampleplayer.MEDIA_INFO_DURATION_);
  }
};


/**
 * Returns the image url for the given media object.
 *
 * @param {!cast.receiver.media.MediaInformation} media The media.
 * @return {string|undefined} The image url.
 * @private
 */
sampleplayer.getMediaImageUrl_ = function(media) {
  var metadata = media.metadata || {};
  var images = metadata['images'] || [];
  return images && images[0] && images[0]['url'];
};


/**
 * Returns the type of player to use for the given media.
 * By default this looks at the media's content type, but falls back
 * to file extension if not set.
 *
 * @param {!cast.receiver.media.MediaInformation} media The media.
 * @return {sampleplayer.Type} The player type.
 * @private
 */
sampleplayer.getType_ = function(media) {
  var contentId = media.contentId || '';
  var contentType = media.contentType || '';
  var contentUrlPath = sampleplayer.getPath_(contentId);
  if (contentType.indexOf('video/') === 0) {
    return sampleplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/x-mpegurl') === 0) {
    return sampleplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/vnd.apple.mpegurl') === 0) {
    return sampleplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/dash+xml') === 0) {
    return sampleplayer.Type.VIDEO;
  } else if (contentType.indexOf('application/vnd.ms-sstr+xml') === 0) {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'm3u8') {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'mp4') {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'ogv') {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'webm') {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'm3u8') {
    return sampleplayer.Type.VIDEO;
  } else if (sampleplayer.getExtension_(contentUrlPath) === 'mpd') {
    return sampleplayer.Type.VIDEO;
  }
  return sampleplayer.Type.UNKNOWN;
};


/**
 * Formats the given duration.
 *
 * @param {number} dur the duration (in seconds)
 * @return {string} the time (in HH:MM:SS)
 * @private
 */
sampleplayer.formatDuration_ = function(dur) {
  function digit(n) { return ('00' + Math.round(n)).slice(-2); }
  var hr = Math.floor(dur / 3600);
  var min = Math.floor(dur / 60) % 60;
  var sec = dur % 60;
  if (!hr) {
    return digit(min) + ':' + digit(sec);
  } else {
    return digit(hr) + ':' + digit(min) + ':' + digit(sec);
  }
};


/**
 * Adds the given className to the given element for the specified amount of
 * time.
 *
 * @param {!Element} element The element to add the given class.
 * @param {string} className The class name to add to the given element.
 * @param {number} timeout The amount of time (in ms) the class should be
 *     added to the given element.
 * @return {number} A numerical id, which can be used later with
 *     window.clearTimeout().
 * @private
 */
sampleplayer.addClassWithTimeout_ = function(element, className, timeout) {
  element.classList.add(className);
  return setTimeout(function() {
    element.classList.remove(className);
  }, timeout);
};


/**
 * Causes the given element to fade out, does something, and then fades
 * it back in.
 *
 * @param {!Element} element The element to fade in/out.
 * @param {number} time The total amount of time (in seconds) to transition.
 * @param {function()} something The function that does something.
 * @private
 */
sampleplayer.transition_ = function(element, time, something) {
  sampleplayer.fadeOut_(element, time / 2.0, function() {
    something();
    sampleplayer.fadeIn_(element, time / 2.0);
  });
};


/**
 * Preloads media data that can be preloaded.
 *
 * @param {!cast.receiver.media.MediaInformation} media The media to load.
 * @param {function()} doneFunc The function to call when done.
 * @private
 */
sampleplayer.preload_ = function(media, doneFunc) {
  var imagesToPreload = [];

  // try to preload image metadata
  var thumbnailUrl = sampleplayer.getMediaImageUrl_(media);
  if (thumbnailUrl) {
    imagesToPreload.push(thumbnailUrl);
  }

  if (imagesToPreload.length === 0) {
    doneFunc();
  } else {
    var counter = 0;
    var images = [];
    for (var i = 0; i < imagesToPreload.length; i++) {
      images[i] = new Image();
      images[i].src = imagesToPreload[i];
      images[i].onload = function() {
        if (++counter === imagesToPreload.length) {
          doneFunc();
        }
      };
    }
  }
};


/**
 * Causes the given element to fade in.
 *
 * @param {!Element} element The element to fade in.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeIn_ = function(element, time, opt_doneFunc) {
  sampleplayer.fadeTo_(element, '', time, opt_doneFunc);
};


/**
 * Causes the given element to fade out.
 *
 * @param {!Element} element The element to fade out.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeOut_ = function(element, time, opt_doneFunc) {
  sampleplayer.fadeTo_(element, 0, time, opt_doneFunc);
};


/**
 * Causes the given element to fade to the given opacity in the given
 * amount of time.
 *
 * @param {!Element} element The element to fade in/out.
 * @param {string|number} opacity The opacity to transition to.
 * @param {number} time The amount of time (in seconds) to transition.
 * @param {function()=} opt_doneFunc The function to call when complete.
 * @private
 */
sampleplayer.fadeTo_ = function(element, opacity, time, opt_doneFunc) {
  var listener = function() {
    element.style.webkitTransition = '';
    element.removeEventListener('webkitTransitionEnd', listener, false);
    if (opt_doneFunc) {
      opt_doneFunc();
    }
  };
  element.addEventListener('webkitTransitionEnd', listener, false);
  element.style.webkitTransition = 'opacity ' + time + 's';
  element.style.opacity = opacity;
};


/**
 * Utility function to get the extension of a URL file path.
 *
 * @param {string} url the URL
 * @return {string} the extension or "" if none
 * @private
 */
sampleplayer.getExtension_ = function(url) {
  var parts = url.split('.');
  // Handle files with no extensions and hidden files with no extension
  if (parts.length === 1 || (parts[0] === '' && parts.length === 2)) {
    return '';
  }
  return parts.pop().toLowerCase();
};


/**
 * Returns the application state.
 *
 * @param {cast.receiver.media.MediaInformation=} opt_media The current media
 *     metadata
 * @return {string} The application state.
 * @private
 */
sampleplayer.getApplicationState_ = function(opt_media) {
  if (opt_media && opt_media.metadata && opt_media.metadata.title) {
    return 'Now Casting: ' + opt_media.metadata.title;
  } else if (opt_media) {
    return 'Now Casting';
  } else {
    return 'Ready To Cast';
  }
};


/**
 * Returns the URL path.
 *
 * @param {string} url The URL
 * @return {string} The URL path.
 * @private
 */
sampleplayer.getPath_ = function(url) {
  var href = document.createElement('a');
  href.href = url;
  return href.pathname || '';
};


/**
 * Logging utility.
 *
 * @param {string} message to log
 * @private
 */
sampleplayer.CastPlayer.prototype.log_ = function(message) {
  if (this.debug_ && message) {
    console.log(message);
  }
};


/**
 * Sets the inner text for the given element.
 *
 * @param {Element} element The element.
 * @param {string=} opt_text The text.
 * @private
 */
sampleplayer.setInnerText_ = function(element, opt_text) {
  if (!element) {
    return;
  }
  element.innerText = opt_text || '';
};


/**
 * Sets the background image for the given element.
 *
 * @param {Element} element The element.
 * @param {string=} opt_url The image url.
 * @private
 */
sampleplayer.setBackgroundImage_ = function(element, opt_url) {
  if (!element) {
    return;
  }
  element.style.backgroundImage = (opt_url ? 'url("' + opt_url + '")' : 'none');
  element.style.display = (opt_url ? '' : 'none');
};
