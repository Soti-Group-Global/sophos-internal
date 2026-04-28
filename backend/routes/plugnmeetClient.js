// PlugNmeet client wrapper
const crypto = require("crypto");
const axios = require("axios");

const DEFAULT_BASE_URL = "https://meet.sotiglobal.com";

class PlugNmeetClient {
  constructor(
    apiKey = process.env.PLUGNMEET_API_KEY || "",
    apiSecret = process.env.PLUGNMEET_API_SECRET || "",
    baseUrl = process.env.PLUGNMEET_BASE_URL || DEFAULT_BASE_URL
  ) {
    this.API_KEY = apiKey;
    this.API_SECRET = apiSecret;
    this.BASE_URL = baseUrl;

    this.http = axios.create({
      baseURL: this.BASE_URL,
      timeout: 10000,
      headers: { "Content-Type": "application/json" },
    });
  }

  generateSignature(body) {
    return crypto
      .createHmac("sha256", this.API_SECRET)
      .update(typeof body === "string" ? body : JSON.stringify(body))
      .digest("hex");
  }

  async makeRequest(endpoint, body) {
    const bodyString = JSON.stringify(body);
    const signature = this.generateSignature(bodyString);

    try {
      const res = await this.http.post(endpoint, body, {
        headers: {
          "API-KEY": this.API_KEY,
          "HASH-SIGNATURE": signature,
        },
      });
      return res.data;
    } catch (error) {
      throw error;
    }
  }

  // ---------------- Room management ----------------
  async createRoom(roomId, title = "Meeting Room", options = {}) {
    const defaultMetadata = {
      room_title: title,
      welcome_message: options.welcomeMessage || "Welcome to the meeting!",
      max_participants: options.maxParticipants || 50,
      room_features: {
        allow_webcams: options.allowWebcams !== false,
        mute_on_start: options.muteOnStart || false,
        allow_screen_share: options.allowScreenShare !== false,
        allow_rtmp: options.allowRtmp || false,
        admin_only_webcams: options.adminOnlyWebcams || false,
        allow_view_other_webcams: options.allowViewOtherWebcams !== false,
        allow_view_other_users_list: options.allowViewOtherUsersList !== false,
        enable_analytics: options.enableAnalytics || false,
        allow_virtual_bg: options.allowVirtualBg || false,
        allow_raise_hand: options.allowRaiseHand !== false,
        auto_gen_user_id: options.autoGenUserId || false,
        room_duration: 0,
        recording_features: {
          is_allow: options.allowRecording !== false,
          is_allow_cloud: options.allowCloudRecording !== false,
          is_allow_local: options.allowLocalRecording !== false,
          enable_auto_cloud_recording:
            options.enableAutoCloudRecording || false,
        },
        chat_features: {
          allow_chat: options.allowChat !== false,
          allow_file_upload: options.allowFileUpload || false,
        },
        shared_note_pad_features: {
          allowed_shared_note_pad: options.allowSharedNotepad || false,
        },
        whiteboard_features: {
          allowed_whiteboard: options.allowWhiteboard || false,
        },
        external_media_player_features: {
          allowed_external_media_player: options.allowExternalMedia || false,
        },
        waiting_room_features: {
          is_active: options.waitingRoom || false,
        },
        breakout_room_features: {
          is_allow: options.allowBreakoutRooms || false,
          allowed_number_rooms: options.maxBreakoutRooms || 6,
        },
        display_external_link_features: {
          is_allow: options.allowExternalLinks || false,
        },
        ingress_features: {
          is_allow: options.allowIngress || false,
        },
        speech_to_text_translation_features: {
          is_allow: options.allowSpeechToText || false,
          is_allow_translation: options.allowTranslation || false,
        },
        end_to_end_encryption_features: {
          is_enabled: options.enableE2EE || false,
        },
      },
      default_lock_settings: options.defaultLockSettings || {
        lock_microphone: false,
        lock_webcam: false,
        lock_screen_sharing: false,
        lock_chat: false,
        lock_chat_send_message: false,
        lock_chat_file_share: false,
        lock_private_chat: false,
      },
    };

    const bodyObj = {
      room_id: roomId,
      metadata: { ...defaultMetadata, ...options.metadata },
      empty_timeout: options.emptyTimeout || 3600,
    };

    return this.makeRequest("/auth/room/create", bodyObj);
  }

  // ---------------- Join tokens ----------------
  async getJoinToken(roomId, userInfo) {
    const userMetadata = {
      preferred_lang: userInfo.preferredLang || "en-US",
      record_webcam: userInfo.recordWebcam !== false,
      ex_user_id:
        userInfo.externalUserId || userInfo.userId || userInfo.user_id,
      extra_data: userInfo.extraData || "",
      lock_settings: userInfo.lockSettings || {
        lock_microphone: false,
        lock_webcam: false,
        lock_screen_sharing: false,
        lock_chat: false,
        lock_chat_send_message: false,
        lock_chat_file_share: false,
      },
    };

    if (userInfo.profilePic && userInfo.profilePic.trim() !== "") {
      userMetadata.profile_pic = userInfo.profilePic;
    } else if (userInfo.name) {
      // Auto-generate avatar if none provided
      userMetadata.profile_pic = `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name)}&background=random`;
    }

    const bodyObj = {
      room_id: roomId,
      user_info: {
        name: userInfo.name,
        user_id: userInfo.userId || userInfo.user_id || `user_${Date.now()}`,
        is_admin: userInfo.isAdmin || false,
        is_hidden: userInfo.isHidden || false,
        user_metadata: userMetadata,
      },
    };

    return this.makeRequest("/auth/room/getJoinToken", bodyObj);
  }

  // ---------------- Room state ----------------
  async isRoomActive(roomId) {
    return this.makeRequest("/auth/room/isRoomActive", { room_id: roomId });
  }

  async getActiveRoomInfo(roomId) {
    return this.makeRequest("/auth/room/getActiveRoomInfo", {
      room_id: roomId,
    });
  }

  async getActiveRoomsInfo() {
    return this.makeRequest("/auth/room/getActiveRoomsInfo", {});
  }

  async fetchPastRooms(roomIds, options = {}) {
    const bodyObj = {
      room_ids: roomIds,
      from: options.from || 0,
      limit: options.limit || 20,
      order_by: options.orderBy || "DESC",
    };
    return this.makeRequest("/auth/room/fetchPastRooms", bodyObj);
  }

  async endRoom(roomId) {
    return this.makeRequest("/auth/room/endRoom", { room_id: roomId });
  }

  // ---------------- Recording management ----------------
  async fetchRecordings(roomIds, from = 0, limit = 20, orderBy = "DESC") {
    const bodyObj = {
      room_ids: roomIds,
      from: from,
      limit: limit,
      order_by: orderBy,
    };
    return this.makeRequest("/auth/recording/fetch", bodyObj);
  }

  async getRecordingDownloadToken(recordId) {
    const bodyObj = {
      record_id: recordId,
    };
    return this.makeRequest("/auth/recording/getDownloadToken", bodyObj);
  }

  // ---------------- Helpers ----------------
  async createOrJoinRoom(roomId, title, options = {}) {
    
    const activeCheck = await this.isRoomActive(roomId);

    if (activeCheck.status && activeCheck.is_active) {
      return {
        status: true,
        message: "Room already active",
        roomId,
        isNewRoom: false,
        roomInfo: await this.getActiveRoomInfo(roomId),
      };
    }

    
    // Ensure empty_timeout is set
    const createOptions = {
      ...options,
      emptyTimeout: options.emptyTimeout || 3600,
    };

    const createResult = await this.createRoom(roomId, title, createOptions);

    if (createResult.status) {
      return {
        status: true,
        message: "Room created successfully",
        roomId,
        isNewRoom: true,
        roomInfo: createResult,
      };
    }
    
    throw new Error(createResult.msg);
  }

  // NEW: All-in-one join function for doctors
  async joinDoctorRoom(doctorId, doctorName, options = {}) {
    try {
      
      // Use persistent room ID
      const roomId = options.roomId || `doctor_${doctorId}`;
      const title = `${doctorName} - Consultation`;
      
      // Step 1: Check if room is active
      const roomStatus = await this.isRoomActive(roomId);
      let isNewRoom = false;
      
      // Step 2: Create room if inactive
      if (!roomStatus.is_active) {
        
        const createOptions = {
          maxParticipants: options.maxParticipants || 10,
          allowRecording: options.allowRecording !== false,
          allowChat: options.allowChat !== false,
          allowScreenShare: options.allowScreenShare !== false,
          emptyTimeout: options.emptyTimeout || 7200, // 2 hours
          metadata: {
            doctorId: doctorId,
            doctorName: doctorName,
            specialty: options.specialty || "",
            createdFor: "doctor_consultation",
            createdAt: new Date().toISOString(),
          }
        };
        
        const createResult = await this.createRoom(roomId, title, createOptions);
        
        if (!createResult.status) {
          throw new Error(`Failed to create room: ${createResult.msg}`);
        }
        
        isNewRoom = true;
      } else {
      }
      
      // Step 3: Generate fresh token
      const tokenResult = await this.getJoinToken(roomId, {
        name: doctorName,
        userId: `doctor_${doctorId}_${Date.now()}`,
        isAdmin: true,
        profilePic: options.profilePic || `https://ui-avatars.com/api/?name=${encodeURIComponent(doctorName)}&background=random`,
      });
      
      if (!tokenResult.status) {
        throw new Error(`Failed to generate token: ${tokenResult.msg}`);
      }
      
      // Step 4: Return complete join info
      return {
        status: true,
        roomId,
        token: tokenResult.token,
        joinUrl: `${this.BASE_URL}/?access_token=${tokenResult.token}`,
        isNewRoom,
        doctorName,
        message: isNewRoom ? "Created new room session" : "Joined existing room session",
      };
      
    } catch (error) {
      throw error;
    }
  }

  generateJoinUrl(token, customDesign = null) {
    let url = `${this.BASE_URL}/?access_token=${token}`;
    if (customDesign) {
      const encodedDesign = encodeURIComponent(JSON.stringify(customDesign));
      url += `&custom_design=${encodedDesign}`;
    }
    return url;
  }

  async generateModeratorJoinUrl(roomId, userName, userId) {
    const tokenResult = await this.getJoinToken(roomId, {
      name: userName,
      userId,
      isAdmin: true,
    });

    if (tokenResult.status) {
      return {
        success: true,
        joinUrl: this.generateJoinUrl(tokenResult.token),
        token: tokenResult.token,
      };
    }
    throw new Error(`Failed to generate token: ${tokenResult.msg}`);
  }

  async generateParticipantJoinUrl(roomId, userName, userId, options = {}) {
    const tokenResult = await this.getJoinToken(roomId, {
      name: userName,
      userId,
      isAdmin: options.isAdmin || false,
      isHidden: options.isHidden || false,
      profilePic: options.profilePic,
      lockSettings: options.lockSettings,
    });

    if (tokenResult.status) {
      return {
        success: true,
        joinUrl: this.generateJoinUrl(tokenResult.token, options.customDesign),
        token: tokenResult.token,
      };
    }
    throw new Error(`Failed to generate token: ${tokenResult.msg}`);
  }
}

// Default instance
const plugNmeetClient = new PlugNmeetClient();

// Export all functions
module.exports = {
  PlugNmeetClient,
  plugNmeetClient,
  createRoom: plugNmeetClient.createRoom.bind(plugNmeetClient),
  getJoinToken: plugNmeetClient.getJoinToken.bind(plugNmeetClient),
  isRoomActive: plugNmeetClient.isRoomActive.bind(plugNmeetClient),
  createOrJoinRoom: plugNmeetClient.createOrJoinRoom.bind(plugNmeetClient),
  joinDoctorRoom: plugNmeetClient.joinDoctorRoom.bind(plugNmeetClient),
  endRoom: plugNmeetClient.endRoom.bind(plugNmeetClient),
  fetchRecordings: plugNmeetClient.fetchRecordings.bind(plugNmeetClient),
};