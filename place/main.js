// rplace.tk bot
// Draw an image to a specified point on the website https://rplace.tk
// Designed to run in a browser's F12 console,
// or as a standalone JS file to be hosted on a website and run by its visitors
// Made by crexalbo

////////////////////////////////////////////////////////////////////////////////
// Globals

// User-controlled parameters
const IMAGE_URL  = "img.png";
const IMAGE_LEFT = 1337;
const IMAGE_TOP  = 69;

// Other constants
const PALETTE = [0xff1a006d,0xff3900be,0xff0045ff,0xff00a8ff,0xff35d6ff,0xffb8f8ff,0xff68a300,0xff78cc00,0xff56ed7e,0xff6f7500,0xffaa9e00,0xffc0cc00,0xffa45024,0xffea9036,0xfff4e951,0xffc13a49,0xffff5c6a,0xffffb394,0xff9f1e81,0xffc04ab4,0xffffabe4,0xff7f10de,0xff8138ff,0xffaa99ff,0xff2f486d,0xff26699c,0xff70b4ff,0xff000000,0xff525251,0xff908d89,0xffd9d7d4,0xffffffff];
const WIDTH = 2000;
const HEIGHT = 2000;
const COOLDOWN = 10e3;

// Variables
let board = null;
let src_data = null;
let CD = 0;

////////////////////////////////////////////////////////////////////////////////
// Helper functions

//==============================================================================
function loadImage () {
	// Init function to load image data from URL
	
	// Create a canvas element in memory
	let src_canvas = document.createElement('canvas');
	src_canvas.width = source_image.width; src_canvas.height = source_image.height;
	
	// Draw source image to canvas and grab pixel data
	let src_cx = src_canvas.getContext('2d');
	src_cx.drawImage( source_image, 0,0, source_image.width, source_image.height );
	src_data = src_cx.getImageData( 0,0, source_image.width, source_image.height );
	
}

//==============================================================================
function colorFromImg ( x, y ) {
	// Grab the color code for the pixel at specified x,y coords.
	// Returns -1 if color in image isn't in the palette.
	
	// Get raw RGBA data from image
	let img_r = src_data.data[ 4 * ( x + (y * src_data.width) ) + 0 ];
	let img_g = src_data.data[ 4 * ( x + (y * src_data.width) ) + 1 ];
	let img_b = src_data.data[ 4 * ( x + (y * src_data.width) ) + 2 ];
	let img_a = src_data.data[ 4 * ( x + (y * src_data.width) ) + 3 ];
	
	// Convert to hex (PALETTE is in ABGR)
	let img_c = ((img_a << 24 >>> 0) | (img_b << 16 >>> 0) | (img_g << 8 >>> 0) | (img_r << 0 >>> 0)) >>> 0;
	
	// Get index of color in PALETTE
	return PALETTE.indexOf(img_c);
	
}

//==============================================================================
function putPixel ( x, y, color ) {
	// Place a pixel of specified color at (x,y)
	
	// Manage cooldown
	if (CD>Date.now())
		return false;
	else
		CD = Date.now() + COOLDOWN;
	
	// Build out data packet to send via websocket
	let a = new DataView(new Uint8Array(6).buffer);
	a.setUint8(0, 4);
	a.setUint32(1, x + (y * WIDTH));
	a.setUint8(5, color);
	ws.send(a);
	
	return true;
	
}

////////////////////////////////////////////////////////////////////////////////
// Load the source image and prepare for reading

let source_image = new Image();
source_image.onload = loadImage;
source_image.src = IMAGE_URL;

////////////////////////////////////////////////////////////////////////////////
// Main bot loop

setInterval( () => {

	// If the board isn't set up yet, then wait for the next iteration
	if (!board)
		return console.log('The board hasn\'t loaded in yet. Retrying after cooldown...');
	
	// Loop over image, left to right then top to bottom
	for (let y = 0; y < src_data.height; y++) for (let x = 0; x < src_data.width; x++) {
	
		// The color we want the board to show
		intendedColor = colorFromImg( x, y );
		
		// Skip over colors that don't exist in the palette
		if (intendedColor == -1) continue;
	
		// If the board is not correct, draw the correct color and wait for timeout
		if (board[ x + IMAGE_LEFT + ((y + IMAGE_TOP) * 2000) ] != intendedColor) {
			console.log('Drawing color ' + intendedColor + ' at location (' + (x + IMAGE_LEFT) + ',' + (y + IMAGE_TOP) + ')');
			if (!putPixel( x + IMAGE_LEFT, y + IMAGE_TOP, intendedColor ))
				console.log('Error placing pixel. Most likely, either the global cooldown has changed, or this IP has been rate-limit banned.');
			return;
		}
		
	}
	
	// If we made it this far, the image is already correct.
	console.log('Image is up-to-date, no action needs to be taken.');
	
}, COOLDOWN + 100);

////////////////////////////////////////////////////////////////////////////////
// Original Interface
// Literally copy-pasted from rplace.tk with only minor changes/deletions
// I could clean this up, but it runs fine and it's not my code, so meh

function runLengthChanges(data){
	let i = 1, boardI = 0
	while(i < data.byteLength){
		let cell = data.getUint8(i++)
		let c = cell >> 6
		if(c == 1)c = data.getUint8(i++)
		else if(c == 2)c = data.getUint16(i++),i++
		else if(c == 3)c = data.getUint32(i++),i+=3
		boardI += c
		seti(boardI++, cell & 63)
	}
}
let load = false
fetch('https://rplace.tk/place').then(a=>a.arrayBuffer()).then(a => {
	board = new Uint8Array(a)
	if(load)runLengthChanges(load)
	load = true
})
let ws = new WebSocket('wss://server.rplace.tk')
ws.onmessage = async function({data}){
	data = new DataView(await data.arrayBuffer())
	let code = data.getUint8(0)
	if(code == 1){
		CD = data.getUint32(1) * 1000
	}else if(code == 2){
		//run length coding
		if(!load)load = data
		else runLengthChanges(data)
	}else if(code == 7){
		CD = data.getUint32(1) * 1000
		seti(data.getUint32(5), data.getUint8(9))
	}else if(code == 6){
		let i = 0
		while(i < data.byteLength - 2){
			seti(data.getUint32(i += 1), data.getUint8(i += 4))
		}
	}
}
ws.onclose = () => {
	if(CD != Infinity)return location.reload()
	//Something went wrong...
	CD = 1e100
}
function seti(i, b){
	if (board) board[i] = b;
}
