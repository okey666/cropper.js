/* 
* cropper.js -- v0.1
* Copyright 2012 Oscar Key
* A simple image cropping library which uses pure Javascript and the <canvas> tag in order to crop images in the browser.
*/

/* 
* This program is free software: you can redistribute it and/or modify
* it under the terms of the GNU General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
* 
* This program is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU General Public License for more details.
* 
* You should have received a copy of the GNU General Public License
* along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

(function(cropper, undefined) {
	"use strict"; // helps us catch otherwise tricky bugs
	
	/* DRAWING STUFF */
	var canvas;
	var context;
	
	var image;
	var restoreImage;
	var currentDimens = {};
	var cropping = false;
	
	var colors = {
		white: "#ffffff",
		black: "#000000",
		overlay: "rgba(0, 0, 0, 0.75)"
	};
	
	var overlay = {
		x: 50,
		y: 50,
		width: 100,
		height: 100,
		resizerSide: 10,
		ratioXY: 1
	};
	
	function draw() {
		// clear the screen by drawing a white box
		context.fillStyle = colors.white;
		context.fillRect(0, 0, canvas.width, canvas.height);
		
		// if we don't have an image file, abort the draw at this point
		if(image === undefined) {
			return;
		}
		
		// draw the image
		var dimens = currentDimens;
		context.drawImage(image, 0, 0, dimens.width, dimens.height);
		
		// draw cropping stuff if we are cropping
		if(cropping) {
			// draw the overlay
			drawOverlay();
			
			// draw the resizer
			context.save();
			context.fillStyle = colors.black;
			context.fillRect(overlay.x + overlay.width - 5, overlay.y + overlay.height - 5, overlay.resizerSide, overlay.resizerSide);
			context.restore();
		}
	}
	
	function drawOverlay() {
		// draw the overlay using a path made of 4 trapeziums (ahem)
		context.save();
		
		context.fillStyle = colors.overlay;
		context.beginPath();
		
		context.moveTo(0, 0);
		context.lineTo(overlay.x, overlay.y);
		context.lineTo(overlay.x + overlay.width, overlay.y);
		context.lineTo(canvas.width, 0);
		
		context.moveTo(canvas.width, 0);
		context.lineTo(overlay.x + overlay.width, overlay.y);
		context.lineTo(overlay.x + overlay.width, overlay.y + overlay.height);
		context.lineTo(canvas.width, canvas.height);
		
		context.moveTo(canvas.width, canvas.height);
		context.lineTo(overlay.x + overlay.width, overlay.y + overlay.height);
		context.lineTo(overlay.x, overlay.y + overlay.height);
		context.lineTo(0, canvas.height);
		
		context.moveTo(0, canvas.height);
		context.lineTo(overlay.x, overlay.y + overlay.height);
		context.lineTo(overlay.x, overlay.y);
		context.lineTo(0, 0);
		
		context.fill();
		
		context.restore();
	}
	
	function setRatio(ratio) {
		overlay.ratioXY = ratio;
		overlay.height = Math.floor(overlay.width * ratio);
	}
	
	function getScaledImageDimensions(width, height) {
		// choose the dimension to scale to, depending on which is "more too big"
		var factor = 1;
		if((canvas.width - width) < (canvas.height - height)) {
			// scale to width
			factor = canvas.width / width;
		} else {
			// scale to height
			factor = canvas.height / height;
		}
		// important "if,else" not "if,if" otherwise 1:1 images don't scale
		
		var dimens = {
			width: Math.floor(width * factor),
			height: Math.floor(height * factor),
			factor: factor
		};
		
		return dimens;
	}
	
	
	
	/* EVENT LISTENER STUFF */
	var drag = {
		type: "", // options: "moveOverlay", "resizeOverlay"
		inProgress: false,
		originalOverlayX: 0,
		originalOverlayY: 0,
		originalX: 0,
		originalY: 0,
		originalOverlayWidth: 0,
		originalOverlayHeight: 0
	};
	
	function addEventListeners() {
		// add mouse listeners to the canvas
		canvas.onmousedown = function(event) {
			// depending on where the mouse has clicked, choose which type of event to fire
			//var x = event.offsetX;
			//var y = event.offsetY;
			var x = event.clientX - canvas.offsetLeft;
			var y = event.clientY - canvas.offsetTop;
			
			// if the mouse clicked in the overlay
			if(x > overlay.x && x < (overlay.x + overlay.width) && y > overlay.y && y < (overlay.y + overlay.height)) {
				drag.type = "moveOverlay";
				drag.inProgress = true;
				drag.originalOverlayX = x - overlay.x;
				drag.originalOverlayY = y - overlay.y;
			}
			if(x > (overlay.x + overlay.width - overlay.resizerSide) && x < (overlay.x + overlay.width + overlay.resizerSide) && y > (overlay.y + overlay.height - overlay.resizerSide) && y < (overlay.y + overlay.height + overlay.resizerSide)) {
				drag.type = "resizeOverlay";
				drag.inProgress = true;
				drag.originalX = x;
				drag.originalY = y;
				drag.originalOverlayWidth = overlay.width;
				drag.originalOverlayHeight = overlay.height;
			}
		};
		
		canvas.onmouseup = function(event) {
			// cancel any drags
			drag.inProgress = false;
		};
		
		canvas.onmouseout = function(event) {
			// cancel any drags
			drag.inProgress = false;
		};
		
		canvas.onmousemove = function(event) {
			// give up if there is no drag in progress
			if(!drag.inProgress) {
				return;
			}
			
			var x = event.clientX - canvas.offsetLeft;
			var y = event.clientY - canvas.offsetTop;
			
			// check what type of drag to do
			if(drag.type === "moveOverlay") {
				overlay.x = x - drag.originalOverlayX;
				overlay.y = y - drag.originalOverlayY;
				draw();
			} else if(drag.type === "resizeOverlay") {
				overlay.width = drag.originalOverlayWidth + (x - drag.originalX);
				
				// do not allow the overlay to get too small
				if(overlay.width < 10) {
					overlay.width = 10;
				}
				
				overlay.height = overlay.width * overlay.ratioXY;
				draw();
			}
		};
	}
	
	
	/* CROPPING FUNCTIONS */	
	function cropImage(entire) {
		// if we don't have an image file, abort at this point
		if(image === undefined) {
			return false;
		}
		
		// if we aren't cropping, ensure entire is tru
		if(!cropping) {
			entire = true;
		}
		
		// assume we want to crop the entire image, this will be overriden below
		var x = 0;
		var y = 0;
		var width = image.width;
		var height = image.height;
		
		if(!entire) {
			// work out the actual dimensions that need cropping
			var factor = currentDimens.factor;
			x = Math.floor(overlay.x / factor);
			y = Math.floor(overlay.y / factor);
			width = Math.floor(overlay.width / factor);
			height = Math.floor(overlay.height / factor);
			
			// check the values are within range of the image
			if(x < 0){ x = 0; }
			if(x > image.width){ x = image.width; }
			if(y < 0){ y = 0; }
			if(y > image.height){ y = image.height; }
			
			if(x + width > image.width){ width = image.width - x; }
			if(y + height > image.height){ height = image.height - y; }
		}
		
		// load the image into the cropping canvas
		var cropCanvas = document.createElement("canvas");
		cropCanvas.setAttribute("width", width);
		cropCanvas.setAttribute("height", height);
		
		var cropContext = cropCanvas.getContext("2d");
		cropContext.drawImage(image, x, y, width, height, 0, 0, width, height);
		
		return cropCanvas;
	}
	
	
	/* API FUNCTIONS */
	cropper.showImage = function(src) {
		cropping = false;
		image = new Image();
		image.onload = function() {
			currentDimens = getScaledImageDimensions(image.width, image.height) ; // work out the scaling
			draw();
		};
		image.src = src;
	};
	
	cropper.startCropping = function() {
		// only continue if an image is loaded
		if(image === undefined) {
			return false;
		}
		
		// save the current state
		restoreImage = new Image();
		restoreImage.src = image.src;
		
		cropping = true;
		draw();
		
		return true;
	};
	
	cropper.getCroppedImageSrc = function() {
		if(image) {
			// return the cropped image
			var cropCanvas = cropImage(!cropping); // cropping here controls if we get the entire image or not, desirable if the user is not cropping
			var url = cropCanvas.toDataURL("png");
			cropping = false;
			cropper.showImage(url);
			return url;
		} else {
			return false;
		}
	};
	
	cropper.getCroppedImageBlob = function() {
		return; // this function is not fully implemented yet
		if(image) {
			// return the cropped image
			var cropCanvas = cropImage(!cropping); // cropping here controls if we get the entire image or not, desirable if the user is not cropping
			cropping = false;
			cropper.showImage(cropCanvas.toDataURL());
			return cropCanvas.toBlob();
		} else {
			return false;
		}
	};
	
	cropper.start = function(newCanvas, ratio) {
		// get the context from the given canvas
		canvas = newCanvas;
		if(!canvas.getContext) {
			return; // give up
		}
		context = canvas.getContext("2d");
		
		// set up the overlay ratio
		if(ratio) {
			setRatio(ratio);
		}
		
		// setup mouse stuff
		addEventListeners();
	};
	
	cropper.restore = function() {
		if(restoreImage === undefined) {
			return false;
		}
		
		cropping = false;
		
		// show the saved image
		cropper.showImage(restoreImage.src);
		return true;
	};
	
}(window.cropper = window.cropper || {}));