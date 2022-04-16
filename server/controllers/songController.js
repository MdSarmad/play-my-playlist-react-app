const roomModel = require("../model/roomModel");
const songModel = require("../model/songModel");
const voteModel = require("../model/voteModel");
const userModel = require("../model/userModel");
const scorePointModel = require("../model/scorePointModel");
const Joi = require("joi");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Generate random roomID
const addSong = async (req, res) => {
  const { room_id, player_id, song } = req.body;
  try {
    const gameData = await songModel
      .find({ room_id })
      .select("+song +player_id");
    const songsCount = await songModel
      .where({ room_id: room_id, player_id: player_id })
      .count();
    // Cannot add songs more than 5 songs
    if (songsCount + 1 > 5) {
      return res.status(400).json({
        success: false,
        message: "You can add only 5 songs.",
      });
    }
    let songAdded,
      songExists = false,
      ownSong = false;
    if (gameData.length === 0) {
      songAdded = await songModel.create({ room_id, player_id, song });
    } else {
      gameData.forEach((item) => {
        if (item.song === song) {
          if (item.player_id === player_id) {
            ownSong = true;
          } else {
            songExists = true;
          }
        }
      });
      if (ownSong === true) {
        return res.status(400).json({
          success: false,
          message: "You have already added the song.",
        });
      } else if (songExists === true) {
        return res.status(400).json({
          success: false,
          message: "Song has already been added by someone in the room.",
        });
      } else {
        songAdded = await songModel.create({ room_id, player_id, song });
      }
    }
    return res.status(200).json({
      success: true,
      message: "Song has successfully been added.",
      songAdded,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Some error occured in the server." });
  }
};

const deleteSong = async (req, res) => {
  const { song_id } = req.body;
  try {
    const songData = await songModel.findOne({ _id: song_id });
    if (songData === null) {
      return res.status(400).json({
        success: false,
        message: "Can't find the song you are looking for.",
      });
    } else {
      // const deleteSong = await songModel.findOneAndUpdate({ room_id, player_id }, { songs: songsArray });
      const deletedSong = await songModel.findByIdAndRemove({ _id: song_id });
      return res.status(200).json({
        success: true,
        message: "Song has been deleted.",
        deletedSong,
      });
    }
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong." });
  }
};

const getRoomSongs = async (req, res) => {
  const { room_id, player_id } = req.body;
  try {
    const roomData = await songModel.find({ room_id });
    if (roomData.host_id !== player_id) {
      return res.status(400).json({
        success: false,
        message: "You are not authorized for this action.",
      });
    }
    const songsData = await songModel.find({ room_id });
    const songsCount = await songModel.where({ room_id: room_id }).count();
    return res.status(200).json({
      success: true,
      message: `Successfully fetched songs of room: ${room_id} .`,
      songsCount,
      songsData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error, message: "Something went wrong." });
  }
};

const getPlayerSongs = async (req, res) => {
  const { room_id, player_id } = req.body;
  try {
    const gameData = await songModel
      .find({ room_id, player_id })
      .select("-room_id -player_id");
    const songsCount = await songModel
      .where({ room_id: room_id, player_id: player_id })
      .count();
    return res.status(200).json({
      success: true,
      message: "Successfully fetched all songs.",
      songsCount: songsCount,
      songsData: gameData,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Some error occurred in server." });
  }
};

const getSongById = async (req, res) => {
  const { song_id } = req.body;
  try {
    const songInfo = await songModel.find({ _id: song_id });
    if (songInfo.length === 0) {
      return res
        .status(400)
        .json({ status: false, message: "Coould not find the song." });
    }
    return res.status(200).json({
      success: true,
      songInfo: songInfo[0],
      message: "Successfully fetched the song.",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ status: false, message: "Unexpected error in server." });
  }
};

const chooseRandomRoomSong = async (req, res) => {
  const { room_id } = req.body;
  try {
    const roomData = await roomModel.find({ _id: room_id });

    if (roomData.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Please enter a valid roomID." });
    }

    console.log("room_id");
    console.log(room_id);
    const songsData = await songModel.find({ room_id, song_status: "not_played" });
    // const songsCount = await songModel.where({ room_id: room_id }).count();

    let song_index = Math.floor(Math.random() * songsData.length); // find a rondom index number for songsData
    let randomSong = songsData[song_index];

    return res.status(200).json({
      success: true,
      randomSong,
      songsData,
      song_index,
      message: "Successfully fetched song.",
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong in the server." });
  }
};

// Route for voting a particular player
const votePlayer = async (req, res) => {
  const { room_id, song_id, voted_player_id, player_id } = req.body;
  try {
    const schema = Joi.object({
      room_id: Joi.string().min(4).required().label("Room ID"),
      song_id: Joi.string().required().label("Song"),
      voted_player_id: Joi.string().required().label("Voted Player"),
      player_id: Joi.string().required().label("Player ID"),
    });
    // Validation of details recieved starts here
    const validate = schema.validate({
      room_id,
      song_id,
      voted_player_id,
      player_id,
    });
    const { error } = validate;
    if (error) {
      message = error.details[0].message;
      return res.status(400).json({ success: false, message });
    }
    
    // Check the player cannot vote themselves
    if (player_id === voted_player_id) {
      return res.status(400).json({ success: false, message: "You cannot vote yourself." });
    }

    let points = 0,
      votedUserData;

    const songData = await songModel.find({ _id: song_id });
    let voteData = await voteModel.find({ room_id, player_id, song_id });
    
    let scoreDetails = await scorePointModel.find({ room_id, player_id });
    
    //Fetch voted user Details
    votedUserData = await userModel.find({ _id: voted_player_id });

    // Check for valid inputs
    if (songData.length === 0 || votedUserData.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid data input." });
    }

    if (voted_player_id == songData[0].player_id) {
      points = 10;
    }

    if (voteData.length === 0) {
      voteData = await voteModel.create({
        room_id,
        player_id,
        voted_player_id,
        song_id,
        current_points: points,
      });
      
    } else {
      await voteModel.update(
        { room_id, player_id, song_id },
        { voted_player_id, current_points: points }
      );
      
      if (voteData[0].current_points == 10 && voted_player_id == songData[0].player_id) {
        points = scoreDetails[0].points;
      } else if (voteData[0].current_points == 10 && voted_player_id != songData[0].player_id) {
        points = scoreDetails[0].points - 10;
      }
      voteData = await voteModel.find({ room_id, player_id, song_id });
      
    }
    
    if (scoreDetails.length === 0) {
      
      scoreData = await scorePointModel.create({ room_id, player_id, points });

    } else {
      
      scoreData = await scorePointModel.findOneAndUpdate(
        { room_id, player_id },
        { points },
        { new: true }
      );

    }

    return res.status(200).json({
      success: true,
      message: "Vote Player success.",
      voteData: voteData[0],
      voted_player: votedUserData[0].name.split(" ")[0],
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Some error occurred in server." });
  }
};

// Route for voting a particular player
const fetchUserVote = async (req, res) => {
  const { room_id, player_id } = req.body;
  try {
    return res
      .status(200)
      .json({ success: true, message: "Successfully fetched user vote." });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Some error occurred in server." });
  }
};

const fetchVotedPlayers = async (req, res) => {
  try {
    const { room_id, song_id } = req.body;

    const schema = Joi.object({
      room_id: Joi.string().min(4).required().label("Room ID"),
      song_id: Joi.string().required().label("Song"),
    });
    // Validation of details recieved starts here
    const validate = schema.validate({ room_id, song_id });
    const { error } = validate;
    if (error) {
      message = error.details[0].message;
      return res.status(400).json({ success: false, message });
    }

    const votedPlayers = await voteModel.aggregate([
      { $match: { room_id: ObjectId(room_id), song_id: ObjectId(song_id) } },
      {
        $lookup: {
          from: "users",
          localField: "player_id",
          foreignField: "_id",
          as: "player",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "player_id",
          foreignField: "_id",
          as: "voted_player",
        },
      },
      { $unwind: "$player" },
      { $unwind: "$voted_player" },
      {
        $project: {
          "player.email": 0,
          "player.password": 0,
          "player.profile_pic_url": 0,
          "player.activation": 0,
          "player.createdAt": 0,
          "player.updatedAt": 0,
          "player.game_status": 0,
          "voted_player.email": 0,
          "voted_player.password": 0,
          "voted_player.profile_pic_url": 0,
          "voted_player.activation": 0,
          "voted_player.createdAt": 0,
          "voted_player.updatedAt": 0,
          "voted_player.game_status": 0,
        },
      },
    ]);

    // Fetch voted info (like songName, players_ids) from db
    // const votedData = await voteModel.find({ room_id, song_id }); // also fetch scores with it

    return res
      .status(200)
      .json({
        success: true,
        // votedData,
        votedPlayers,
        message: "Successfully fetched voted info",
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Some error occurred in server." });
  }
};

const removeVotedSongs = async (req, res) => {
  const { song_id } = req.body;
  try {
    const deletedSong = await songModel.deleteMany({ _id: song_id });
    console.log("deletedSong");
    console.log(deletedSong);
    const deletedVotes = await voteModel.deleteMany({ song_id });
    console.log("deletedVotes");
    console.log(deletedVotes);

    return res
      .status(200)
      .json({ success: true, message: "Votes and songs deleted." });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Some error occured in the server." });
  }
};

const fetchPlayersVoteStatus = async (req, res) => {
  try {
    const { room_id, song_id } = req.body;

    const schema = Joi.object({
      room_id: Joi.string().min(4).required().label("Room ID"),
      song_id: Joi.string().min(4).required().label("Song ID"),
    });
    // Validation of details recieved starts here
    const validate = schema.validate({ room_id, song_id });
    const { error } = validate;
    if (error) {
      message = error.details[0].message;
      return res.status(400).json({ success: false, message });
    }

    // const votedPlayers = await voteModel.find({ room_id, song_id });
    const votedPlayers = await voteModel.aggregate([
      { $match: { room_id: ObjectId(room_id), song_id: ObjectId(song_id) } },
      {
        $lookup: {
          from: "users",
          localField: "player_id",
          foreignField: "_id",
          as: "player",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "player_id",
          foreignField: "_id",
          as: "voted_player",
        },
      },
      { $unwind: "$player" },
      { $unwind: "$voted_player" },
      {
        $project: {
          "player.email": 0,
          "player.password": 0,
          "player.profile_pic_url": 0,
          "player.activation": 0,
          "player.createdAt": 0,
          "player.updatedAt": 0,
          "player.game_status": 0,
          "voted_player.email": 0,
          "voted_player.password": 0,
          "voted_player.profile_pic_url": 0,
          "voted_player.activation": 0,
          "voted_player.createdAt": 0,
          "voted_player.updatedAt": 0,
          "voted_player.game_status": 0,
        },
      },
    ]);

    return res
      .status(200)
      .json({
        success: true,
        votedPlayers,
        message: "Fetched player vote status.",
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong in server." });
    }
  };
  
  const changeSongStatus = async (req, res) => {
    try {
      const { room_id, song_id, status } = req.body;

      const schema = Joi.object({
        room_id: Joi.string().min(4).required().label("Room ID"),
        song_id: Joi.string().min(4).required().label("Song ID"),
        status: Joi.string().valid("not_played","played").label("Song ID"),
      });
      // Validation of details recieved starts here
      const validate = schema.validate({ room_id, song_id });
      const { error } = validate;
      if (error) {
        message = error.details[0].message;
        return res.status(400).json({ success: false, message });
      }
      
      let songData = await songModel.find({ room_id, song_id });
      
      if (songData.length === 0) {
        return res.status(400).json({ success: false, message: "Data does not exist." });
      }

      songData = await songModel.update({ room_id, song_id },{ song_status: status });

      return res
      .status(200)
      .json({ success: true, message: "Song status successfully changed."});
    } catch(error) {
    return res
      .status(500)
      .json({ success: false, message: "Something went wrong in server." });
  }
}

const fetchPlayersScores = async (req, res) => {
  try {
    const { room_id, song_id } = req.body;

    const schema = Joi.object({
      room_id: Joi.string().min(4).required().label("Room ID"),
      song_id: Joi.string().min(4).required().label("Song ID"),
    });
    // Validation of details recieved starts here
    const validate = schema.validate({ room_id, song_id });
    const { error } = validate;
    if (error) {
      message = error.details[0].message;
      return res.status(400).json({ success: false, message });
    }

    // const votedData = await userModel.find({ active_room: room_id }).count();
    const votedDataCount = await voteModel.find({ room_id, song_id }).count();
    const activeUsersCount = await userModel
      .find({ active_room: room_id })
      .count();

    if (votedDataCount !== activeUsersCount) {
      return res
        .status(202)
        .json({ success: false, message: "All users have not voted." });
    }

    // let scoreData = await scorePointModel.find({ room_id });
    // let scoreData = await scorePointModel.aggregate([
    //   { $match: { room_id: ObjectId(room_id) } },
    //   {
    //     $lookup: {
    //       from: "users",
    //       localField: "player_id",
    //       foreignField: "_id",
    //       as: "player"
    //     }
    //   },
    //   { $unwind: "$player" },
    // ]);

    let scoreData = await voteModel.aggregate([
      { $match: { room_id: ObjectId(room_id), song_id: ObjectId(song_id) } },
      {
        $lookup: {
          from: "users",
          localField: "player_id",
          foreignField: "_id",
          as: "player"
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "voted_player_id",
          foreignField: "_id",
          as: "voted_player"
        }
      },
      {
        $lookup: {
          from: "score_points",
          localField: "room_id",
          foreignField: "room_id",
          localField: "player_id",
          foreignField: "player_id",
          as: "score_points"
        }
      },
      { $unwind: "$player" },
      { $unwind: "$voted_player" },
      { $unwind: "$score_points" },
      {
        $project: {
          "player._id": 0,
          "player.email": 0,
          "player.active_room": 0,
          "player.profile_pic_url": 0,
          "player.activation": 0,
          "player.password": 0,
          "player.createdAt": 0,
          "player.updatedAt": 0,
          "player.game_status": 0,
          "voted_player._id": 0,
          "voted_player.email": 0,
          "voted_player.active_room": 0,
          "voted_player.profile_pic_url": 0,
          "voted_player.activation": 0,
          "voted_player.password": 0,
          "voted_player.createdAt": 0,
          "voted_player.updatedAt": 0,
          "voted_player.game_status": 0,
          "score_points._id": 0,
          "score_points.room_id": 0,
          "score_points.createdAt": 0,
          "score_points.updatedAt": 0,
        }
      }
    ]);

    return res
      .status(200)
      .json({
        success: true,
        scoreData,
        message: "Player scores successfully fetched.",
      });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Some error occured in the server." });
  }
};

module.exports = {
  addSong,
  deleteSong,
  getRoomSongs,
  getPlayerSongs,
  getSongById,
  chooseRandomRoomSong,
  votePlayer,
  fetchUserVote,
  fetchVotedPlayers,
  removeVotedSongs,
  fetchPlayersVoteStatus,
  changeSongStatus,
  fetchPlayersScores,
};
