const botSettings = require("./config.json");
const Discord = require("discord.js");
const axios = require("axios");
const yt = require("ytdl-core");
const YouTube = require("simple-youtube-api");
const fs = require("fs");
const getYTID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");
const prefix = botSettings.prefix;
const ytApiKey = botSettings.ytApiKey;
const youtube = new YouTube(ytApiKey);

const bot = new Discord.Client({
	disableEveryone: true
});

/* MUSIC VARIABLES */
let queue = []; // Songs queue
let songsQueue = []; // Song names stored for queue command
let isPlaying = false; // Is music playing
let dispatcher = null;
let voiceChannel = null;
let skipRequest = 0; // Stores the number of skip requests 
let skippers = []; // Usernames of people who voted to skip the song
let ytResultList = []; // Video names results from yt command
let ytResultAdd = []; // For storing !add command choice
/* MUSIC VARIABLES END */
let re = /^(?:[1-5]|0[1-5]|10)$/; // RegEx for allowing only 1-5 while selecting song from yt results
let youtubeSearched = false; // If youtube has been searched (for !add command)
let selectUser; // Selecting user from guild

bot.on("ready", async () => {
	console.log(`Bot is ready! ${bot.user.username}`);

	try {
		let link = await bot.generateInvite(["ADMINISTRATOR"]);
		console.log(link);
	} catch (e) {
		console.log(e.stack);
	}

});

bot.on("message", async message => {
	if (message.author.bot) return;
	if (message.channel.type === "dm") return;

	let messageContent = message.content.split(" ");
	let command = messageContent[0];
	let args = messageContent.slice(1);

	if (!command.startsWith(prefix)) return;

	switch (command.slice(1).toLowerCase()) {
		case "userinfo":
			if (args.length == 0) { // Displays the message author info if args are empty
				let embed = new Discord.RichEmbed()
					.setThumbnail(message.author.avatarURL)
					.setColor("#8A2BE2")
					.setDescription(`User info for: **${message.author.username}**`)
					.addField("Avatar:", `[Link](${message.author.avatarURL})`, true)
					.addField("Status:", message.author.presence.status, true)
					.addField("Bot: ", message.author.bot, true)
					.addField("In game: ", message.author.presence.game ? message.author.presence.game : "Not in game", true)
					.addField("Tag: ", message.author.tag, true)
					.addField("Discriminator:", message.author.discriminator, true)
					.addBlankField()
					.setFooter(`Profile created at: ${message.author.createdAt}`);

				message.channel.send(embed);
			} else { // Else displays info of user from args
				if (message.guild.available) {
					let selectUser = message.guild.member(message.mentions.users.first() || message.guild.members.get(args[0]));
					let embed = new Discord.RichEmbed()
						.setThumbnail(selectUser.user.displayAvatarURL)
						.setColor("#8A2BE2")
						.setDescription(`User info for: **${selectUser.user.username}**`)
						.addField("Avatar:", `[Link](${selectUser.user.displayAvatarURL})`, true)
						.addField("Status:", selectUser.user.presence.status, true)
						.addField("Bot: ", selectUser.user.bot, true)
						.addField("In game: ", selectUser.user.presence.game ? selectUser.user.presence.game : "Not in game", true)
						.addField("Tag: ", selectUser.user.tag, true)
						.addField("Discriminator:", selectUser.user.discriminator, true)
						.addBlankField()
						.setFooter(`Profile created at: ${selectUser.user.createdAt}`);

					message.channel.send(embed);
				}
			}
			break;

		case "play":
			if (args.length == 0) {
				// TODO: If music isn't playing but there's songs in queue from youtube search, play that
			} else if (queue.length > 0 || isPlaying) {
				getID(args).then(id => {
					if (id) {
						queue.push(id);
						getYouTubeResultsId(args, 1).then(ytResults => {
							message.reply(`added to queue **${ytResults[0]}**`);
							songsQueue.push(ytResults[0]);
						}).catch(error => console.log(error));
					} else {
						message.reply("sorry, couldn't find the song.");
					}
				}).catch(error => console.log(error));
			} else {
				isPlaying = true;
				getID(args).then(id => {
					if (id) {
						queue.push(id);
						playMusic(id, message);
						getYouTubeResultsId(args, 1).then(ytResults => {
							message.reply(`now playing **${ytResults[0]}**`);
							songsQueue.push(ytResults[0]);
						}).catch(error => console.log(error));
					} else {
						message.reply("sorry, couldn't find the song.");
					}
				}).catch(error => console.log(error));
			}
			break;

		case "skip":
			console.log(queue);
			if (queue.length === 1) {
				message.reply("queue is empty now, type !play or !yt to play/search new songs!");
				dispatcher.end();
				setTimeout(() => voiceChannel.leave(), 1000);
			} else {
				if (skippers.indexOf(message.author.id) === -1) {
					skippers.push(message.author.id);
					skipRequest++;

					if (skipRequest >= Math.ceil((voiceChannel.members.size - 1) / 2)) {
						skipSong(message);
						message.reply("your skip has been added to the list. Skipping!");
					} else {
						message.reply(`your skip has been added to the list. You need **${Math.ceil((voiceChannel.members.size - 1) / 2) - skipRequest}** more to skip current song!`);
					}
				} else {
					message.reply("you already voted to skip!");
				}
			}
			break;

		case "queue":
			if (queue.length === 0) {
				message.reply("queue is empty now, type !play or !yt to play/search new songs!");
			} else {
				let format = "```"
				for (const songName in songsQueue) {
					if (songsQueue.hasOwnProperty(songName)) {
						let temp = `${parseInt(songName) + 1}: ${songsQueue[songName]} ${songName == 0 ? "**(Current Song)**" : ""}\n`;
						if ((format + temp).length <= 2000 - 3) {
							format += temp;
						} else {
							format += "```";
							message.channel.send(format);
							format = "```";
						}
					}
				}
				format += "```";
				message.channel.send(format);
			}
			break;

		case "stop":
			dispatcher.end();
			setTimeout(() => voiceChannel.leave(), 1000);
			break;

		case "yt":
			message.channel.send("```Searching youtube...```");
			getYouTubeResultsId(args, 5).then(ytResults => {
				ytResultAdd = ytResults;
				let ytEmbed = new Discord.RichEmbed()
					.setColor("#FF0000")
					.setAuthor("Youtube search results: ", icon_url = "https://cdn1.iconfinder.com/data/icons/logotypes/32/youtube-512.png")
					.addField("1:", "```" + ytResults[0] + "```")
					.addField("2:", "```" + ytResults[1] + "```")
					.addField("3:", "```" + ytResults[2] + "```")
					.addField("4:", "```" + ytResults[3] + "```")
					.addField("5:", "```" + ytResults[4] + "```")
					.addBlankField()
					.setFooter("Send !add [result number] to queue the song.");
				message.channel.send(ytEmbed);
				youtubeSearched = true;
			}).catch(err => console.log(err));
			break;

		case "add":
			if (youtubeSearched === true) {
				if (!re.test(args)) {
					message.reply("you entered the wrong song number or character. Please only enter 1-5 for song number to be queued.");
				} else {
					let choice = ytResultAdd[args - 1];
					getID(choice).then(id => {
						if (id) {
							queue.push(id);
							getYouTubeResultsId(choice, 1).then(ytResults => {
								message.reply(`added to queue **${ytResults[0]}**`);
								songsQueue.push(ytResults[0]);
							}).catch(error => console.log(error));
						}
					}).catch(error => console.log(error));
					youtubeSearched = false;
					message.reply(`youTube result ${args} was added to the queue!`);
				}
			} else {
				message.reply("you need to use !yt [search term] command first to add song from the list to the queue.");
			}
	}
});

/*--------------------------------*/
/* MUSIC CONTROL FUNCTIONS START */
/*------------------------------*/
function playMusic(id, message) {
	voiceChannel = message.member.voiceChannel;

	voiceChannel.join()
		.then(connection => {
			console.log("Connected...");
			stream = yt(`https://www.youtube.com/watch?v=${id}`, {
				filter: 'audioonly'
			})

			skipRequest = 0;
			skippers = [];

			dispatcher = connection.playStream(stream);
			dispatcher.on('end', () => {
				skipRequest = 0;
				skippers = [];
				queue.shift();
				songsQueue.shift();
				if (queue.length === 0) {
					queue = [];
					songsQueue = [];
					isPlaying = false;
				} else {
					setTimeout(() => playMusic(queue[0], message), 500);
				}
			});
		})
		.catch(error => console.log(error));
}

async function getID(str) {
	if (str.indexOf("youtube.com") > -1) {
		return getYTID(str);
	} else {
		let body = await axios(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=${encodeURIComponent(str)}&key=${ytApiKey}`);
		if (body.data.items[0] === undefined) {
			return null;
		} else {
			return body.data.items[0].id.videoId;
		}
	}
}

function addToQueue(strID) {
	if (strID.indexOf("youtube.com")) {
		queue.push(getYTID(strID));
	} else {
		queue.push(strID);
		songsQueue.push(strID);
	}
}

function skipSong(message) {
	dispatcher.end();
}
/*------------------------------*/
/* MUSIC CONTROL FUNCTIONS END */
/*----------------------------*/

/*----------------------------------*/
/* YOUTUBE CONTROL FUNCTIONS START */
/*--------------------------------*/
async function searchYouTube(str) {
	let search = await axios(`https://www.googleapis.com/youtube/v3/search?part=id&type=video&q=${encodeURIComponent(str)}&key=${ytApiKey}`);
	if (search.data.items[0] === undefined) {
		return null;
	} else {
		return search.data.items;
	}
}

async function getYouTubeResultsId(ytResult, numOfResults) {
	let resultsID = [];
	await youtube.searchVideos(ytResult, numOfResults)
		.then(results => {
			for (const resultId of results) {
				resultsID.push(resultId.title);
			}
		})
		.catch(err => console.log(err));
	return resultsID;
}
/*--------------------------------*/
/* YOUTUBE CONTROL FUNCTIONS END */
/*------------------------------*/

bot.login(botSettings.token);
