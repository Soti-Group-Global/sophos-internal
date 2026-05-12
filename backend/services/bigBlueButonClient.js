const crypto = require("crypto");
const axios = require("axios");
const xml2js = require("xml2js");
const mongoose = require("mongoose");

const DEFAULT_BASE_URL = "https://meet.sotiglobal.com/bigbluebutton/api";

class BigBlueButtonClient {
  constructor(
    apiSecret = process.env.BBB_SECRET || "",
    baseUrl = process.env.BBB_URL || DEFAULT_BASE_URL
  ) {
    this.API_SECRET = apiSecret;
    this.BASE_URL = baseUrl.replace(/\/$/, ""); // Remove trailing slash

    this.http = axios.create({
      timeout: 30000,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) // For self-signed certs
    });

    this.xmlParser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: true,
      trim: true,
    });
  }

  /**
   * Generate SHA-1 checksum for API calls
   * checksum = SHA1(callName + queryString + sharedSecret)
   */
  generateChecksum(callName, queryString = "") {
    const stringToHash = callName + queryString + this.API_SECRET;
    return crypto.createHash("sha1").update(stringToHash, 'utf8').digest("hex");
  }

  /**
   * Build query string from parameters object
   * Converts booleans to "true"/"false" strings for BBB API
   */
  buildQueryString(params) {
    const queryParts = [];

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;

      // Convert boolean to string "true"/"false"
      let stringValue;
      if (typeof value === 'boolean') {
        stringValue = value ? "true" : "false";
      } else if (Array.isArray(value)) {
        // Handle arrays (for multiple recordIDs, etc.)
        stringValue = value.join(',');
      } else {
        stringValue = String(value);
      }

      queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(stringValue)}`);
    }

    return queryParts.join('&');
  }

  /**
   * Parse XML response to JSON
   */
  async parseXmlResponse(xmlString) {
    try {
      // Handle case where response is already JSON (some BBB proxies may convert it)
      if (typeof xmlString === 'object') {
        return xmlString;
      }

      // If it's a string starting with [ or {, it's JSON
      if (typeof xmlString === 'string' && (xmlString.trim().startsWith('[') || xmlString.trim().startsWith('{'))) {
        return JSON.parse(xmlString);
      }

      // Otherwise parse as XML
      const result = await this.xmlParser.parseStringPromise(xmlString);
      return result.response || result;
    } catch (error) {
      throw new Error("Failed to parse BBB response");
    }
  }

  /**
   * Make GET request to BBB API
   */
  async makeGetRequest(callName, params = {}) {
    // Build query string without checksum first
    const queryString = this.buildQueryString(params);

    // Generate checksum with the query string
    const checksum = this.generateChecksum(callName, queryString);

    // Now add checksum to the query string
    const finalQueryString = queryString
      ? `${queryString}&checksum=${checksum}`
      : `checksum=${checksum}`;

    // BASE_URL is the full API path (e.g., https://server.com/bbb-api)
    const url = `${this.BASE_URL}/${callName}?${finalQueryString}`;

    try {
      const response = await this.http.get(url);

      // Parse XML response
      const result = await this.parseXmlResponse(response.data);

      // Check for BBB-specific errors
      if (result.returncode === "FAILED") {
        const errorMsg = result.messageKey || result.message || `BBB API call ${callName} failed`;
        throw new Error(`BBB API Error: ${errorMsg}`);
      }

      return result;
    } catch (error) {
      // Re-throw with more context
      throw new Error(`BBB API call failed (${callName}): ${error.message}`);
    }
  }

  /**
   * Make POST request to BBB API (for presentations, etc.)
   */
  async makePostRequest(callName, params = {}, body = null) {
    // Build query string without checksum first
    const queryString = this.buildQueryString(params);

    // Generate checksum with the query string
    const checksum = this.generateChecksum(callName, queryString);

    // Now add checksum to the query string
    const finalQueryString = queryString
      ? `${queryString}&checksum=${checksum}`
      : `checksum=${checksum}`;

    // BASE_URL is the full API path (e.g., https://server.com/bbb-api)
    const url = `${this.BASE_URL}/${callName}?${finalQueryString}`;

    try {
      const headers = {};
      if (body) {
        headers["Content-Type"] = "application/xml; charset=utf-8";
      }

      const response = await this.http.post(url, body, { headers });

      // Parse XML response
      const result = await this.parseXmlResponse(response.data);

      // Check for BBB-specific errors
      if (result.returncode === "FAILED") {
        const errorMsg = result.messageKey || result.message || `BBB API call ${callName} failed`;
        throw new Error(`BBB API Error: ${errorMsg}`);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  // ============================================
  // ADMINISTRATION CALLS
  // ============================================

  /**
   * Create a new meeting
   * @param {string} meetingID - Unique meeting identifier
   * @param {string} name - Meeting name
   * @param {object} options - Additional meeting options
   * @returns {object} Meeting creation response
   */
  async createMeeting(meetingID, name, options = {}) {
    const params = {
      name,
      meetingID,
      attendeePW: options.attendeePW || this.generateDeterministicPassword(meetingID, "attendee"),
      moderatorPW: options.moderatorPW || this.generateDeterministicPassword(meetingID, "moderator"),
      welcome: options.welcome || "",
      dialNumber: options.dialNumber,
      voiceBridge: options.voiceBridge || this.generateVoiceBridge(),
      maxParticipants: options.maxParticipants,
      logoutURL: options.logoutURL || process.env.FRONTEND_URL || "http://localhost:3000",
      record: options.record !== false ? "true" : "false", // Default true
      duration: options.duration || 0, // 0 = unlimited
      isBreakout: options.isBreakout ? "true" : "false",
      parentMeetingID: options.parentMeetingID,
      sequence: options.sequence,
      freeJoin: options.freeJoin ? "true" : "false",
      moderatorOnlyMessage: options.moderatorOnlyMessage,
      autoStartRecording: options.autoStartRecording ? "true" : "false",
      allowStartStopRecording: options.allowStartStopRecording !== false ? "true" : "false",
      webcamsOnlyForModerator: options.webcamsOnlyForModerator ? "true" : "false",
      bannerText: options.bannerText,
      bannerColor: options.bannerColor,
      muteOnStart: options.muteOnStart ? "true" : "false",
      allowModsToUnmuteUsers: options.allowModsToUnmuteUsers ? "true" : "false",
      lockSettingsDisableCam: options.lockSettingsDisableCam ? "true" : "false",
      lockSettingsDisableMic: options.lockSettingsDisableMic ? "true" : "false",
      lockSettingsDisablePrivateChat: options.lockSettingsDisablePrivateChat ? "true" : "false",
      lockSettingsDisablePublicChat: options.lockSettingsDisablePublicChat ? "true" : "false",
      lockSettingsDisableNotes: options.lockSettingsDisableNotes ? "true" : "false",
      lockSettingsHideUserList: options.lockSettingsHideUserList !== false ? "true" : "false",
      lockSettingsLockOnJoin: options.lockSettingsLockOnJoin !== false ? "true" : "false",
      guestPolicy: options.guestPolicy || "ALWAYS_ACCEPT", // ALWAYS_ACCEPT, ALWAYS_DENY, ASK_MODERATOR
      meetingKeepEvents: options.meetingKeepEvents ? "true" : "false",
      endWhenNoModerator: options.endWhenNoModerator ? "true" : "false",
      endWhenNoModeratorDelayInMinutes: options.endWhenNoModeratorDelayInMinutes || 1,
      meetingLayout: options.meetingLayout || "SMART_LAYOUT",
      logo: options.logo,
      disabledFeatures: options.disabledFeatures,
      // Additional parameters often required
      allowRequestsWithoutSession: options.allowRequestsWithoutSession !== false ? "true" : "false",
      learningDashboardCleanupDelayInMinutes: options.learningDashboardCleanupDelayInMinutes || 1440,
      allowModsToEjectCameras: options.allowModsToEjectCameras ? "true" : "false",
      // Default language to Russian
      "meta_bbb-origin-lang": options.defaultLang || "ru",
      "meta_bbb-default-lang": options.defaultLang || "ru",
      // Meta parameters (custom metadata)
      ...this.buildMetaParams(options.meta),
    };

    // Remove undefined and null values (empty strings are OK for BBB)
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null) {
        delete params[key];
      }
    });

    // Handle banner URL as presentation document
    let body = null;
    if (options.bannerUrl !== undefined && options.bannerUrl !== null && options.bannerUrl !== "") {
      body = `<?xml version="1.0" encoding="UTF-8"?>
<modules>
  <module name="presentation">
    <document url="${this.escapeXml(options.bannerUrl)}" />
  </module>
</modules>`;
    } else if (options.presentations && options.presentations.length > 0) {
      body = this.buildPresentationXml(options.presentations);
    } else if (options.disableDefaultPresentation) {
      // Send empty presentation XML to hide the default presentation
      body = '<?xml version="1.0" encoding="UTF-8"?><modules><module name="presentation"></module></modules>';
    }

    const result = body
      ? await this.makePostRequest("create", params, body)
      : await this.makeGetRequest("create", params);

    if (result.returncode !== "SUCCESS") {
      throw new Error(result.message || "Failed to create meeting");
    }

    return {
      status: true,
      meetingID: result.meetingID,
      internalMeetingID: result.internalMeetingID,
      attendeePW: result.attendeePW,
      moderatorPW: result.moderatorPW,
      createTime: result.createTime,
      voiceBridge: result.voiceBridge,
      dialNumber: result.dialNumber,
      hasUserJoined: result.hasUserJoined === "true",
      duration: parseInt(result.duration) || 0,
      message: result.message,
      messageKey: result.messageKey,
      raw: result,
    };
  }

  /**
   * Generate join URL for a user
   * IMPORTANT: BBB doesn't have a 'role' parameter - it uses password (moderatorPW or attendeePW)
   * @param {string} meetingID - Meeting ID
   * @param {string} fullName - User's display name
   * @param {object} options - Join options
   * @returns {string} Join URL
   */
  getJoinUrl(meetingID, fullName, options = {}) {
    // BBB determines role by which password you use (moderatorPW or attendeePW)
    // There is NO 'role' parameter in BBB API!
    const params = {
      meetingID,
      fullName,
      // Use password parameter, not role!
      password: options.password || (options.isModerator ? options.moderatorPW : options.attendeePW),
      createTime: options.createTime,
      userID: options.userID,
      webVoiceConf: options.webVoiceConf,
      avatarURL: options.avatarURL,
      redirect: options.redirect !== false ? "true" : "false",
      errorRedirectUrl: options.errorRedirectUrl,
      guest: options.guest ? "true" : "false",
      excludeFromDashboard: options.excludeFromDashboard ? "true" : "false",
      enforceLayout: options.enforceLayout,
      // Set Russian as default language
      "userdata-bbb_override_default_locale": "ru",
      // Hide participants list by default
      "userdata-bbb_show_participants_list": "false",
      // Custom userdata parameters
      ...this.buildUserdataParams(options.userdata),
    };

    // Remove undefined and null values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null) {
        delete params[key];
      }
    });

    const queryString = this.buildQueryString(params);
    const checksum = this.generateChecksum("join", queryString);
    // BASE_URL ends with /api, so just append /join
    return `${this.BASE_URL}/join?${queryString}&checksum=${checksum}`;
  }

  /**
   * Join a meeting and get join info (with redirect=false)
   */
  async joinMeeting(meetingID, fullName, options = {}) {
    const params = {
      meetingID,
      fullName,
      // Use password parameter, not role!
      password: options.password || (options.isModerator ? options.moderatorPW : options.attendeePW),
      createTime: options.createTime,
      userID: options.userID,
      avatarURL: options.avatarURL,
      redirect: "false",
      guest: options.guest ? "true" : "false",
      enforceLayout: options.enforceLayout,
      ...this.buildUserdataParams(options.userdata),
    };

    // Remove undefined and null values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null) {
        delete params[key];
      }
    });

    const result = await this.makeGetRequest("join", params);

    if (result.returncode === "SUCCESS") {
      return {
        status: true,
        meetingID: result.meeting_id,
        userID: result.user_id,
        authToken: result.auth_token,
        sessionToken: result.session_token,
        url: result.url,
        message: result.message,
      };
    }

    return {
      status: false,
      message: result.message,
      messageKey: result.messageKey,
    };
  }

  /**
   * End a meeting
   * @param {string} meetingID - Meeting ID to end
   * @param {string} password - Moderator password (required)
   * @returns {object} End meeting response
   */
  async endMeeting(meetingID, password) {
    const result = await this.makeGetRequest("end", {
      meetingID,
      password // Moderator password is required
    });

    return {
      status: result.returncode === "SUCCESS",
      message: result.message,
      messageKey: result.messageKey,
    };
  }

  /**
   * Send chat message to a meeting
   */
  async sendChatMessage(meetingID, message, userName = "System") {
    const result = await this.makeGetRequest("sendChatMessage", {
      meetingID,
      message,
      userName,
    });

    return {
      status: result.returncode === "SUCCESS",
      message: result.message,
    };
  }

  /**
   * Insert documents into a running meeting
   */
  async insertDocument(meetingID, documents) {
    const body = this.buildPresentationXml(documents);
    const result = await this.makePostRequest("insertDocument", { meetingID }, body);

    return {
      status: result.returncode === "SUCCESS",
      message: result.message,
    };
  }

  // ============================================
  // MONITORING CALLS
  // ============================================

  /**
   * Check if a meeting is running
   * @param {string} meetingID - Meeting ID
   * @returns {object} Running status
   */
  async isMeetingRunning(meetingID) {
    const result = await this.makeGetRequest("isMeetingRunning", { meetingID });

    return {
      status: result.returncode === "SUCCESS",
      running: result.running === "true",
    };
  }

  /**
   * Get list of all meetings
   * @returns {object} List of meetings
   */
  async getMeetings() {
    const result = await this.makeGetRequest("getMeetings");

    if (result.returncode !== "SUCCESS") {
      throw new Error(result.message || "Failed to get meetings");
    }

    let meetings = [];
    if (result.meetings && result.meetings.meeting) {
      meetings = Array.isArray(result.meetings.meeting)
        ? result.meetings.meeting
        : [result.meetings.meeting];
    }

    return {
      status: true,
      meetings: meetings.map(m => this.normalizeMeetingInfo(m)),
    };
  }

  /**
   * Get detailed info about a meeting
   * @param {string} meetingID - Meeting ID
   * @param {string} password - Moderator password (optional but recommended)
   * @returns {object} Meeting details
   */
  async getMeetingInfo(meetingID, password) {
    const params = { meetingID };
    if (password) {
      params.password = password;
    }

    const result = await this.makeGetRequest("getMeetingInfo", params);

    if (result.returncode !== "SUCCESS") {
      throw new Error(result.message || result.messageKey || "Failed to get meeting info");
    }

    return {
      status: true,
      ...this.normalizeMeetingInfo(result),
    };
  }

  /**
   * Get default config XML
   */
  async getDefaultConfigXML() {
    const result = await this.makeGetRequest("getDefaultConfigXML");

    return {
      status: result.returncode === "SUCCESS",
      config: result.config,
    };
  }

  // ============================================
  // RECORDING CALLS
  // ============================================

  /**
   * Get recordings
   * @param {object} options - Filter options
   * @returns {object} List of recordings
   */
  async getRecordings(options = {}) {
    const params = {
      meetingID: options.meetingID,
      recordID: options.recordID,
      state: options.state,
      offset: options.offset,
      limit: options.limit,
      ...this.buildMetaParams(options.meta),
    };

    // Remove undefined and null values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === null) {
        delete params[key];
      }
    });

    const result = await this.makeGetRequest("getRecordings", params);

    if (result.returncode !== "SUCCESS") {
      throw new Error(result.message || "Failed to get recordings");
    }

    let recordings = [];
    if (result.recordings && result.recordings.recording) {
      recordings = Array.isArray(result.recordings.recording)
        ? result.recordings.recording
        : [result.recordings.recording];
    }

    return {
      status: true,
      recordings: recordings.map(r => this.normalizeRecordingInfo(r)),
      totalElements: parseInt(result.totalElements) || recordings.length,
    };
  }

  /**
   * Publish or unpublish recordings
   */
  async publishRecordings(recordID, publish = true) {
    const result = await this.makeGetRequest("publishRecordings", {
      recordID,
      publish: publish ? "true" : "false",
    });

    return {
      status: result.returncode === "SUCCESS",
      published: result.published === "true",
    };
  }

  /**
   * Delete recordings
   */
  async deleteRecordings(recordID) {
    const result = await this.makeGetRequest("deleteRecordings", { recordID });

    return {
      status: result.returncode === "SUCCESS",
      deleted: result.deleted === "true",
    };
  }

  /**
   * Update recording metadata
   */
  async updateRecordings(recordID, meta = {}) {
    const params = {
      recordID,
      ...this.buildMetaParams(meta),
    };

    const result = await this.makeGetRequest("updateRecordings", params);

    return {
      status: result.returncode === "SUCCESS",
      updated: result.updated === "true",
    };
  }

  /**
   * Get recording text tracks (captions)
   */
  async getRecordingTextTracks(recordID) {
    const queryString = this.buildQueryString({ recordID });
    const checksum = this.generateChecksum("getRecordingTextTracks", queryString);
    const url = `${this.BASE_URL}/api/getRecordingTextTracks?${queryString}&checksum=${checksum}`;

    try {
      const response = await this.http.get(url);
      // This endpoint returns JSON
      const data = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
      return {
        status: data.response?.returncode === "SUCCESS",
        tracks: data.response?.tracks || [],
      };
    } catch (error) {
      console.error("getRecordingTextTracks error:", error.message);
      return { status: false, tracks: [] };
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate deterministic password from roomId
   * This ensures the same password is generated for the same room every time
   */
  generateDeterministicPassword(roomId, role) {
    const hash = crypto.createHash("sha256")
      .update(roomId + role + this.API_SECRET)
      .digest("hex");
    return hash.substring(0, 16);
  }

  /**
   * Generate random password
   */
  generateRandomPassword(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomBytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      result += chars[randomBytes[i] % chars.length];
    }
    return result;
  }

  /**
   * Generate random voice bridge (5-digit number)
   */
  generateVoiceBridge() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  /**
   * Build meta parameters (meta_key=value)
   */
  buildMetaParams(meta = {}) {
    const params = {};
    for (const [key, value] of Object.entries(meta)) {
      params[`meta_${key}`] = value;
    }
    return params;
  }

  /**
   * Build userdata parameters (userdata-key=value)
   */
  buildUserdataParams(userdata = {}) {
    const params = {};
    for (const [key, value] of Object.entries(userdata)) {
      params[`userdata-${key}`] = value;
    }
    return params;
  }

  /**
   * Build presentation XML for uploads
   */
  buildPresentationXml(presentations) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?><modules><module name="presentation">';

    for (const pres of presentations) {
      if (pres.url) {
        xml += `<document url="${this.escapeXml(pres.url)}"`;
        if (pres.filename) xml += ` filename="${this.escapeXml(pres.filename)}"`;
        if (pres.downloadable) xml += ` downloadable="true"`;
        if (pres.removable === false) xml += ` removable="false"`;
        if (pres.current) xml += ` current="true"`;
        xml += "/>";
      } else if (pres.base64) {
        xml += `<document name="${this.escapeXml(pres.name || 'presentation')}"`;
        if (pres.removable === false) xml += ` removable="false"`;
        xml += `>${pres.base64}</document>`;
      }
    }

    xml += "</module></modules>";
    return xml;
  }

  /**
   * Escape XML special characters
   */
  escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Normalize meeting info response
   */
  normalizeMeetingInfo(meeting) {
    let attendees = [];
    if (meeting.attendees && meeting.attendees.attendee) {
      attendees = Array.isArray(meeting.attendees.attendee)
        ? meeting.attendees.attendee
        : [meeting.attendees.attendee];
    }

    let breakoutRooms = [];
    if (meeting.breakoutRooms && meeting.breakoutRooms.breakout) {
      breakoutRooms = Array.isArray(meeting.breakoutRooms.breakout)
        ? meeting.breakoutRooms.breakout
        : [meeting.breakoutRooms.breakout];
    }

    // Extract metadata
    const metadata = {};
    if (meeting.metadata) {
      Object.keys(meeting.metadata).forEach(key => {
        if (key.startsWith('meta_')) {
          const cleanKey = key.replace('meta_', '');
          metadata[cleanKey] = meeting.metadata[key];
        }
      });
    }

    return {
      meetingName: meeting.meetingName,
      meetingID: meeting.meetingID,
      internalMeetingID: meeting.internalMeetingID,
      createTime: meeting.createTime,
      createDate: meeting.createDate,
      voiceBridge: meeting.voiceBridge,
      dialNumber: meeting.dialNumber,
      attendeePW: meeting.attendeePW,
      moderatorPW: meeting.moderatorPW,
      running: meeting.running === "true",
      duration: parseInt(meeting.duration) || 0,
      hasUserJoined: meeting.hasUserJoined === "true",
      recording: meeting.recording === "true",
      hasBeenForciblyEnded: meeting.hasBeenForciblyEnded === "true",
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      participantCount: parseInt(meeting.participantCount) || 0,
      listenerCount: parseInt(meeting.listenerCount) || 0,
      voiceParticipantCount: parseInt(meeting.voiceParticipantCount) || 0,
      videoCount: parseInt(meeting.videoCount) || 0,
      maxUsers: parseInt(meeting.maxUsers) || 0,
      moderatorCount: parseInt(meeting.moderatorCount) || 0,
      attendees: attendees.map(a => ({
        userID: a.userID,
        fullName: a.fullName,
        role: a.role,
        isPresenter: a.isPresenter === "true",
        isListeningOnly: a.isListeningOnly === "true",
        hasJoinedVoice: a.hasJoinedVoice === "true",
        hasVideo: a.hasVideo === "true",
        clientType: a.clientType,
      })),
      metadata,
      isBreakout: meeting.isBreakout === "true",
      breakoutRooms,
    };
  }

  /**
   * Normalize recording info response
   */
  normalizeRecordingInfo(recording) {
    let playbackFormats = [];
    if (recording.playback && recording.playback.format) {
      const formats = Array.isArray(recording.playback.format)
        ? recording.playback.format
        : [recording.playback.format];

      playbackFormats = formats.map(f => ({
        type: f.type,
        url: f.url,
        processingTime: parseInt(f.processingTime) || 0,
        length: parseInt(f.length) || 0,
        size: parseInt(f.size) || 0,
        preview: f.preview?.images?.image || [],
      }));
    }

    // Extract metadata
    const metadata = {};
    if (recording.metadata) {
      Object.keys(recording.metadata).forEach(key => {
        if (key.startsWith('meta_')) {
          const cleanKey = key.replace('meta_', '');
          metadata[cleanKey] = recording.metadata[key];
        }
      });
    }

    return {
      recordID: recording.recordID,
      meetingID: recording.meetingID,
      internalMeetingID: recording.internalMeetingID,
      name: recording.name,
      isBreakout: recording.isBreakout === "true",
      published: recording.published === "true",
      state: recording.state,
      startTime: recording.startTime,
      endTime: recording.endTime,
      participants: parseInt(recording.participants) || 0,
      rawSize: parseInt(recording.rawSize) || 0,
      metadata,
      playback: playbackFormats,
      // Prefer presentation format (full HTML5 playback with webcams/audio/slides)
      // Fallback: podcast (audio only) or any available format
      playbackUrl: playbackFormats.find(f => f.type === "presentation")?.url ||
        playbackFormats.find(f => f.type === "podcast")?.url ||
        playbackFormats[0]?.url ||
        null,
    };
  }

  // ============================================
  // CONVENIENCE METHODS (PlugNMeet-compatible API)
  // ============================================

  /**
   * Check if room (meeting) is active - PlugNMeet compatible
   */
  async isRoomActive(roomId) {
    try {
      const result = await this.isMeetingRunning(roomId);
      return {
        status: result.status,
        is_active: result.running,
      };
    } catch (error) {
      // Return as not active if check fails - will trigger room creation
      return {
        status: true,
        is_active: false,
      };
    }
  }

  /**
   * Create or join room - PlugNMeet compatible
   */
  async createOrJoinRoom(roomId, title, options = {}) {
    // Use banner URL from options or fallback to test URL
    // Only use fallback if bannerUrl is undefined/null, not if it's an empty string
    let bannerUrl = options.bannerUrl !== undefined && options.bannerUrl !== null
      ? options.bannerUrl
      : "https://static.wixstatic.com/media/e6f22e_a90a0fab7b764c24805e7e43d165d416~mv2.png";

    // First check if meeting is running (with error handling)
    let isRunning = { running: false };
    try {
      isRunning = await this.isMeetingRunning(roomId);
    } catch (error) {
    }

    if (isRunning.running) {
      // If force recreate, end existing meeting first
      if (options.forceRecreate) {
        try {
          await this.endMeeting(roomId, options.moderatorPW);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          // Ignore error
        }
      } else {
        try {
          const meetingInfo = await this.getMeetingInfo(roomId, options.moderatorPW);
          return {
            status: true,
            message: "Room already active",
            roomId,
            isNewRoom: false,
            roomInfo: meetingInfo,
          };
        } catch (err) {
          // Ignore error
        }
      }
    }

    // Create new meeting (or get existing one if BBB says it exists)
    try {
      const createResult = await this.createMeeting(roomId, title, {
        welcome: "Добро пожаловать на вебинар!",
        maxParticipants: options.maxParticipants || 50,
        record: options.record !== false ? "true" : "false",
        duration: options.duration || 0,
        muteOnStart: options.muteOnStart ? "true" : "false",
        logo: options.logo,
        logoutURL: options.logoutURL,
        meetingLayout: options.meetingLayout || "SMART_LAYOUT",
        autoStartRecording: options.autoStartRecording ? "true" : "false",
        allowStartStopRecording: options.allowStartStopRecording !== false ? "true" : "false",
        bannerUrl: bannerUrl, // Pass banner URL directly
        guestPolicy: "ALWAYS_ACCEPT", // Users auto-join once meeting is active
        meta: options.metadata || {},
      });

      if (createResult.status) {
        return {
          status: true,
          message: "Room created successfully",
          roomId,
          isNewRoom: true,
          roomInfo: createResult,
          attendeePW: createResult.attendeePW,
          moderatorPW: createResult.moderatorPW,
        };
      }
    } catch (error) {
      // If the error is "idNotUnique" or "meeting already exists", the meeting is already there
      // Just return success - users can join with deterministic passwords
      if (error.message && (error.message.includes("already exists") || error.message.includes("idNotUnique"))) {

        return {
          status: true,
          message: "Room already exists",
          roomId,
          isNewRoom: false,
          attendeePW: this.generateDeterministicPassword(roomId, "attendee"),
          moderatorPW: this.generateDeterministicPassword(roomId, "moderator"),
        };
      }

      // Re-throw other errors
      throw error;
    }

    throw new Error("Failed to create meeting");
  }

  /**
   * Get join token/URL - PlugNMeet compatible
   * Returns join URL instead of token (BBB uses URL-based joining)
   */
  async getJoinToken(roomId, userInfo) {
    // Get meeting info to get passwords
    let meetingInfo;
    try {
      meetingInfo = await this.getMeetingInfo(roomId);
    } catch (error) {
      throw new Error(`Meeting ${roomId} not found: ${error.message}`);
    }

    // Determine password based on user role
    const password = userInfo.isAdmin
      ? meetingInfo.moderatorPW
      : meetingInfo.attendeePW;

    const joinUrl = this.getJoinUrl(roomId, userInfo.name, {
      password: password,
      userID: userInfo.userId || userInfo.user_id,
      avatarURL: userInfo.profilePic,
      redirect: true,
      userdata: userInfo.extraData || {},
    });

    return {
      status: true,
      token: joinUrl, // BBB uses URL, not token
      joinUrl: joinUrl,
      password: password,
      isModerator: userInfo.isAdmin,
    };
  }

  /**
   * End room - PlugNMeet compatible
   */
  async endRoom(roomId, moderatorPW) {
    try {
      return await this.endMeeting(roomId, moderatorPW);
    } catch (error) {
      return { status: false, message: error.message };
    }
  }

  /**
   * Fetch recordings - PlugNMeet compatible
   */
  async fetchRecordings(roomIds, from = 0, limit = 20, orderBy = "DESC") {
    const recordings = [];

    // If roomIds is empty, get all recordings
    if (!roomIds || roomIds.length === 0) {
      const result = await this.getRecordings({
        offset: from,
        limit,
      });

      if (result.status && result.recordings.length > 0) {
        recordings.push(...result.recordings);
      }
    } else {
      // BBB doesn't support multiple meetingIDs in one call, so we iterate
      for (const roomId of roomIds) {
        const result = await this.getRecordings({
          meetingID: roomId,
          offset: from,
          limit,
        });

        if (result.status && result.recordings.length > 0) {
          recordings.push(...result.recordings);
        }
      }
    }

    // Sort recordings
    recordings.sort((a, b) => {
      const timeA = parseInt(a.startTime) || 0;
      const timeB = parseInt(b.startTime) || 0;
      return orderBy === "DESC" ? timeB - timeA : timeA - timeB;
    });

    return {
      status: true,
      recordings_list: recordings.slice(from, from + limit),
      recordings: recordings.slice(from, from + limit),
      total: recordings.length,
    };
  }

  /**
   * Get recording download token - BBB doesn't use tokens, returns direct URL
   */
  async getRecordingDownloadToken(recordId) {
    const result = await this.getRecordings({ recordID: recordId });

    if (result.status && result.recordings.length > 0) {
      const recording = result.recordings[0];
      const presentationFormat = recording.playback.find(p => p.type === "presentation");

      return {
        status: true,
        token: recordId, // Return recordId as token for compatibility
        url: presentationFormat?.url || recording.playback[0]?.url,
        recording,
      };
    }

    return {
      status: false,
      token: null,
    };
  }
}

// Default instance using environment variables
const bbbClient = new BigBlueButtonClient(
  process.env.BBB_SECRET,
  process.env.BBB_URL
);

// Test function
async function testBBBClient() {

  try {

    const meetings = await bbbClient.getMeetings();


    const testMeetingId = `test-${Date.now()}`;
    const newMeeting = await bbbClient.createMeeting(
      testMeetingId,
      "Test Meeting from Client"
    );

    const running = await bbbClient.isMeetingRunning(testMeetingId);


    const moderatorUrl = bbbClient.getJoinUrl(testMeetingId, "Moderator", {
      password: newMeeting.moderatorPW,
      isModerator: true
    });
    const attendeeUrl = bbbClient.getJoinUrl(testMeetingId, "Attendee", {
      password: newMeeting.attendeePW,
      isModerator: false
    });

    const meetingInfo = await bbbClient.getMeetingInfo(testMeetingId, newMeeting.moderatorPW);


    const recordings = await bbbClient.getRecordings();


  } catch (error) {
    console.error("Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Export all functions (PlugNMeet-compatible interface)
module.exports = {
  BigBlueButtonClient,
  bbbClient,
  testBBBClient,

  // Main instance methods
  createMeeting: bbbClient.createMeeting.bind(bbbClient),
  getJoinUrl: bbbClient.getJoinUrl.bind(bbbClient),
  joinMeeting: bbbClient.joinMeeting.bind(bbbClient),
  endMeeting: bbbClient.endMeeting.bind(bbbClient),
  isMeetingRunning: bbbClient.isMeetingRunning.bind(bbbClient),
  getMeetings: bbbClient.getMeetings.bind(bbbClient),
  getMeetingInfo: bbbClient.getMeetingInfo.bind(bbbClient),
  getRecordings: bbbClient.getRecordings.bind(bbbClient),
  publishRecordings: bbbClient.publishRecordings.bind(bbbClient),
  deleteRecordings: bbbClient.deleteRecordings.bind(bbbClient),
  updateRecordings: bbbClient.updateRecordings.bind(bbbClient),
  sendChatMessage: bbbClient.sendChatMessage.bind(bbbClient),
  insertDocument: bbbClient.insertDocument.bind(bbbClient),
  getRecordingTextTracks: bbbClient.getRecordingTextTracks.bind(bbbClient),
  getDefaultConfigXML: bbbClient.getDefaultConfigXML.bind(bbbClient),

  // PlugNMeet-compatible methods
  createRoom: bbbClient.createMeeting.bind(bbbClient),
  isRoomActive: bbbClient.isRoomActive.bind(bbbClient),
  createOrJoinRoom: bbbClient.createOrJoinRoom.bind(bbbClient),
  getJoinToken: bbbClient.getJoinToken.bind(bbbClient),
  endRoom: bbbClient.endRoom.bind(bbbClient),
  fetchRecordings: bbbClient.fetchRecordings.bind(bbbClient),
  getRecordingDownloadToken: bbbClient.getRecordingDownloadToken.bind(bbbClient),
};