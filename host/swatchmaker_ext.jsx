﻿//pmsSwatches(["300"],"darken",5,[null,null]);//Set up XMP API for adding metadataif (ExternalObject.AdobeXMPScript == undefined) {    ExternalObject.AdobeXMPScript = new ExternalObject('lib:AdobeXMPScript');}/*    getColorsFromSelection( type )        Gets all colors of provided type (PMS or CMYK) within the selection. Using the internal function    findColors, it cycles through common pageItem types, accesses the fillColor and strokeColor     property of each, then sends this color to a second internal function, setColors, which determines     if the selected color matches the provided type. If so, it adds the color to an array. Once    all pageItems in the selection are examined, the color array is returned as a string.        @param type             A string, one of two options chosen by the user, "cmyk" or "pms".*/function getColorsFromSelection( type ){        /*        findColors( selectedItem )                For each pageItem in a selection, access the fillColor and strokeColor properties according to        the type of Illustrator object it is (PathItem, TextFrame, or GroupItem). Since GroupItems can        be nested within GroupItems basically infinitely, this function is called recursively when a         GroupItem is encountered. When a Color property is accessed, call the setColors function.                @param selectedItem     A single pageItem sent to this function from getColorsFromSelection.    */    function findColors( selectedItem ){        var selectedItemColor;        if(selectedItem.typename == "PathItem"){            selectedItemColor = selectedItem.fillColor;            setColors( selectedItemColor );            selectedItemColor = selectedItem.strokeColor;            setColors( selectedItemColor );        } else if (selectedItem.typename == "TextFrame"){            selectedItemColor = selectedItem.characters[0].fillColor;            setColors( selectedItemColor );            selectedItemColor = selectedItem.characters[0].strokeColor;            setColors( selectedItemColor );        } else if (selectedItem.typename == "GroupItem"){            for(var n=0;n<selectedItem.pageItems.length;n++){                findColors(selectedItem.pageItems[n]);            }        } else {            return;        }    }    /*        setColors( selectionColor, colors )                Set colors that match the color type selected by the user. This function checks if a Color is a        CMYKColor or SpotColor, and stores one or the other according to the global type variable selected by the         user into the global colors array. In the case of a GradientColor, since it can have any number of stops        containing different Color types, this function is called recursively.                @param selectionColor   A Color object sent to this function from getColorsFromSelection.    */        function setColors( selectionColor ){        if(selectionColor.typename == "CMYKColor" && type == "cmyk"){            colors.push(                Math.round(selectionColor.cyan*100)/100 + "/" +                Math.round(selectionColor.magenta*100)/100 + "/" +                Math.round(selectionColor.yellow*100)/100 + "/" +                Math.round(selectionColor.black*100)/100            )        } else if(selectionColor.typename == "SpotColor" && type == "pms"){            var spotName = selectionColor.spot.name;            colors.push(spotName.match(/\d/g).join(""));        } else if(selectionColor.typename == "GradientColor"){            var len = selectionColor.gradient.gradientStops.length;            for(var x=0;x<len;x++){                gradientColor = selectionColor.gradient.gradientStops[x].color;                setColors(gradientColor, colors)            }        }    }        var selection = app.activeDocument.selection;    var colors = [];    if(selection.length == 0) return "";    //For each pageItem in selection, run findColors function    for(var i=0;i<selection.length;i++){        findColors(selection[i]);    }    //This section removes duplicate elements of the array by mapping each one to a key of an object (dupObj), which by design can't have duplicate keys.     //The result is then pushed back into an array which can have toString() run on it. (I stole this ingenious idea from StackOverflow.)    var dupObj = {};    var colorsNoDup = [];    for(var x=0;x<colors.length;x++){        if(colors[x] != "0/0/0/0") dupObj[colors[x]] = 0; //Ignore white swatches when assigning array to keys    }    for(x in dupObj){        colorsNoDup.push(x);    }    return colorsNoDup.toString();}/*    pmsSwatches( pmsColors, stepRange, adjustmentColors )        Begins the process of creating a PMS crop. It adjusts the input to create a format     consistent with the swatch names in the Illustrator PMS Color Book, then calls the     processPMS() function, which calls makeSwatches(). If both are successful,    they return a group of swatches. This function also finishes the process by copying     the group into a new document and resizing the artboard so it's ready to go.        @param pmsColors        An array of strings passed from the Extension via CSInterface.    @param gamut            A string, one of three options chosen from a select. Passed on to                            makeSwatches().    @param stepRange        An int also passed from the Extension, not used in this function                            but passed through to makeSwatches() via processPMS().    @param adjustmentColors A two-element array passed from the Extension, not used in this                             function but passed through to makeSwatches() via processPMS().*/function pmsSwatches( pmsColors, gamut, stepRange, adjustmentColors ){    var pmsDoc = app.open(File("/Volumes/jobs/Prepress/PMS Colors/pms_spot.ai"));    var swatchCrop;    //Create group to hold swatches    var swatchGroup = pmsDoc.groupItems.add();    swatchGroup.name = "SwatchGroup";    //For each PMS color in array, run swatches function    for(var x=0; x<pmsColors.length; x++){        pmsColors[x] = pmsColors[x].replace(/(\b\w|\s\w)/g, function(str){ return str.toUpperCase(); }); //Capitalize first letter of every word to match PMS swatch name format        pmsColors[x] = pmsColors[x].replace(/\bPMS\s*/i, ""); //Remove leading "pms"        //Rename weird ones to match swatches        if (pmsColors[x] == "012") pmsColors[x] = "Yellow 012";        if (pmsColors[x] == "021") pmsColors[x] = "Orange 021";        if (pmsColors[x] == "032") pmsColors[x] = "Red 032";        if (pmsColors[x] == "072") pmsColors[x] = "Blue 072";        try {            swatchCrop = processPMS(pmsColors[x], x*144, gamut, stepRange, adjustmentColors); //Send PMS number and starting position to function, return swatches        } catch(e) {            alert(e);            pmsColors.splice(x, 1); //Remove the index that caused the error            if(pmsColors.length > 0) {                x--; //Adjust counter to compensate            } else {                pmsDoc.close(SaveOptions.DONOTSAVECHANGES);            }        }    }    if(pmsColors.length > 0) {        //Create new document, move PMS crop to that doc, close PMS doc        var swatchDoc = app.documents.addDocument("Print");        var printCrop = swatchCrop.duplicate(swatchDoc);        pmsDoc.close(SaveOptions.DONOTSAVECHANGES);        //Fit artboard to swatches        printCrop.selected = true;        swatchDoc.fitArtboardToSelectedArt(0);        printCrop.selected = false;        //Assign XMPMeta object to add metadata to file        var xmpTarget = new XMPMeta(swatchDoc.XMPString);        xmpTarget.setProperty(XMPConst.NS_XMP, "PrintType", "Crop");        xmpTarget.setProperty(XMPConst.NS_XMP, "DocumentHeight", Math.round((printDocument.height/72) * 100) / 100);        xmpTarget.setProperty(XMPConst.NS_XMP, "DocumentWidth", Math.round((printDocument.width/72) * 100) / 100);        swatchDoc.XMPString = xmpTarget.serialize(XMPConst.SERIALIZE_USE_COMPACT_FORMAT);    }}/*    processPMS( pmsColor, yStart, stepRange, adjustmentColors )        Checks to see if the PMScolor passed to it is a valid PMS color.        It first checks the swatches in the color book loaded into pms_spot.ai. If it is    found there, the pmsColor is passed on to makeSwatches(). If not, it checks for the    PMS color in Kyle's PMS Colors folder. If found there, it adds it to the swatch    group (since this file would be a full swatch crop already it doesn't need to go     through makeSwatches()).        If all fails, throw an Exception.        This function is only called by pmsSwatches().        @param pmsColors        A string passed from pmsSwatches() to be checked for validity.    @param yStart           Starting Y coordinate, not used in this function but passed                             to makeSwatches().    @param gamut            A string, one of three options chosen from a select. Passed on to                            makeSwatches().    @param stepRange        An int also passed from cmykSwatches(), not used in this function                            but passed to makeSwatches().    @param adjustmentColors A two-element array passed from cmykSwatches(), not used in this                             function but passed to makeSwatches().                                @return swatchGroup     The group of swatches created by makeSwatches(). Returned to cmykSwatches().*/function processPMS( pmsColor, yStart, gamut, stepRange, adjustmentColors ){        var pmsDoc = app.documents.getByName("pms_spot.ai");        //Add formatting to match swatch names    var pmsSwatchName = "PANTONE " + pmsColor + " C";        //Check swatch document for PMS color    for(var i = 0; i<pmsDoc.swatches.length; i++){        if (pmsDoc.swatches[i].name == pmsSwatchName){            var swatchGroup = makeSwatches(pmsColor, "PMS", yStart, gamut, stepRange, adjustmentColors);            return swatchGroup;        }    }    //If color is not found in swatch doc, check Kyle's folder    if (!File("/Volumes/jobs/Prepress/PMS Colors/Kyle's PMS Colors/" + pmsColor + ".pdf").exists){        throw new Error("PMS Color " + pmsColor + " could not be found."); //Throw an error if not found there    } else {        var swatchGroup = getExternalSwatches(pmsColor, yStart);        return swatchGroup;    }}/*    cmykSwatches( cmykColors, stepRange, adjustmentColors )        Begins the process of creating a CMYK crop. It checks the input for the correct format     (a number 0-100 delineated by a forward slash(/), dash(-), period(.) or space), then     calls the processCMYK() function, which calls makeSwatches(). If both are successful,    they return a group of swatches. This function also finishes the process by copying     the group into a new document and resizing the artboard so it's ready to go.        @param cmykColors       An array of strings passed from the Extension via CSInterface.    @param gamut            A string, one of three options chosen from a select. Passed on to                            makeSwatches().    @param stepRange        An int also passed from the Extension, not used in this function                            but passed through to makeSwatches() via processCMYK().    @param adjustmentColors A two-element array passed from the Extension, not used in this                             function but passed through to makeSwatches() via processCMYK().*/function cmykSwatches( cmykColors, gamut, stepRange, adjustmentColors ){    var pmsDoc = app.open(File("/Volumes/jobs/Prepress/PMS Colors/pms_spot.ai"));    var swatchCrop;    //Create XMPMeta object to add metadata to file    var xmpTarget;    //Create group to hold swatches    var swatchGroup = pmsDoc.groupItems.add();    swatchGroup.name = "SwatchGroup";        //Loop through each CMYK color, sending it to processCMYK() to check validity, then on    //to makeSwatches to actually create the swatch.    for(var i=0;i<cmykColors.length;i++){        cmykColors[i] = cmykColors[i].split(/\/|-|\s/); //Split into array at / or - or space        try {            swatchCrop = processCMYK(cmykColors[i], i*144, gamut, stepRange, adjustmentColors);        } catch(e) {            alert(e);            cmykColors.splice(i, 1); //Remove invalid CMYK color            if(cmykColors.length > 0) {                i--; //Adjust counter to compensate            } else {                pmsDoc.close(SaveOptions.DONOTSAVECHANGES);            }        }       }    if(cmykColors.length > 0) {        //Create new document, move crop to that doc, close swatch doc        var swatchDoc = app.documents.addDocument("Print");        var printCrop = swatchCrop.duplicate(swatchDoc);        pmsDoc.close(SaveOptions.DONOTSAVECHANGES);        //Fit artboard to swatches        printCrop.selected = true;        swatchDoc.fitArtboardToSelectedArt(0);        printCrop.selected = false;        //Assign XMPMeta object to add metadata to file        var xmpTarget = new XMPMeta(swatchDoc.XMPString);        xmpTarget.setProperty(XMPConst.NS_XMP, "PrintType", "Crop");        xmpTarget.setProperty(XMPConst.NS_XMP, "DocumentHeight", Math.round((printDocument.height/72) * 100) / 100);        xmpTarget.setProperty(XMPConst.NS_XMP, "DocumentWidth", Math.round((printDocument.width/72) * 100) / 100);        swatchDoc.XMPString = xmpTarget.serialize(XMPConst.SERIALIZE_USE_COMPACT_FORMAT);    }}/*    processCMYK( cmykColor, yStart, stepRange, adjustmentColors )        This function checks to see if the CMYK color passed to it is a valid CMYK color.    If not, throw an Exception. If valid, pass it on to makeSwatches().        This function is only called by cmykSwatches().        @param cmykColors       A string passed from cmykSwatches() to be checked for validity.    @param yStart           Starting Y coordinate, not used in this function but passed                             to makeSwatches().    @param gamut            A string, one of three options chosen from a select. Passed on to                            makeSwatches().                            @param stepRange        An int also passed from cmykSwatches(), not used in this function                            but passed to makeSwatches().    @param adjustmentColors A two-element array passed from cmykSwatches(), not used in this                             function but passed to makeSwatches().                                @return swatchGroup     The group of swatches created by makeSwatches(). Returned to cmykSwatches().*/function processCMYK( cmykColor, yStart, gamut, stepRange, adjustmentColors ){    if(cmykColor.length == 4){        for(var x=0;x<4;x++){            if( Number(cmykColor[x]) < 0 || Number(cmykColor[x]) > 100 || isNaN(Number(cmykColor[x])) ){                throw new Error(cmykColor.join("/") + " is not a valid CMYK color.");            } else {                cmykColor[x] = Number(cmykColor[x]);            }        }        var swatchGroup = makeSwatches( cmykColor, "CMYK", yStart, gamut, stepRange, adjustmentColors);        return swatchGroup;    } else {        throw new Error(cmykColor.join("/") + " is not a valid CMYK color.");    }}/*    getExternalSwatches( pmsColor, yStart )        If requested PMS colors are not found in Illustrator's PMS color book,    (this includes Plus, Pastel, Metallic, etc) this function pulls the file    with the same name from Kyle's PMS Colors folder. Then, it copies it    into the pmsDoc, the document where the crop is being built.        The calling function, processPMS(), checks to see if there is a valid file    in the folder before calling this function, so there is no error checking in    this function.        @param pmsColor     A string, the name of the PMS color to open the file for.    @param yStart       Starting Y coordinate to place swatches when pasted into                        crop document.    @return swatchGroup The existing group which this file will be moved into.*/function getExternalSwatches(pmsColor, yStart){    var pmsDoc = app.documents.getByName("pms_spot.ai");    var swatchGroup = pmsDoc.groupItems.getByName( "SwatchGroup" );        var pmsDocExt = app.open(File("/Volumes/jobs/Prepress/PMS Colors/Kyle's PMS Colors/" + pmsColor + ".pdf"));        pmsDocExt.layers[0].hasSelectedArtwork = true;        var pmsDocExtGroup = pmsDocExt.layers[0].groupItems.add();        for (var z=0;z<pmsDocExt.selection.length;z++){        if(pmsDocExt.selection[z].constructor.name == "TextFrame"){            pmsDocExt.selection[z].createOutline();        }        pmsDocExt.selection[z].move(pmsDocExtGroup, ElementPlacement.PLACEATEND);    }    var pmsCopyGroup = pmsDocExtGroup.duplicate(pmsDoc);    pmsCopyGroup.position = [0, -yStart];    pmsCopyGroup.move(swatchGroup, ElementPlacement.PLACEATEND);    pmsDocExt.close(SaveOptions.DONOTSAVECHANGES);        return swatchGroup;     }/*    makeSwatches( colorInput, type, yStart, stepRange, adjustmentColors )        The workhorse. Creates a swatch crop, which is added to the existing group    of all the swatches being made.        When creating a swatch crop, it first makes a swatch of the starting color    (colorInput) with labels, then determines which channels to adjust, either    taking the user-defined channels or deciding on its own. Then it runs some    logic to ensure that no swatch channel values go above 100 or fall below 0,    while still encompassing the range provided. Finally, it actually places the    swatches, cycling through 5 adjustments in one channel, then 5 adjustments    in the second channel, for a total of 25 adjustments.        @param colorInput       The color passed from processPMS() or processCMYK().    @param type             The type of color in colorInput, either PMS (spot) or                             CMYK (process).    @param yStart           Starting Y coordinate to place swatches.    @param stepRange        The difference in color between swatches.    @param adjustmentColors A two-element array, containing two channels to adjust.                             If undefined, makeSwatches() picks two itself.        @return swatchGroup     A group of all swatches made so far.*/function makeSwatches( colorInput, type, yStart, gamut, stepRange, adjustmentColors ){    var pmsDoc = app.documents.getByName("pms_spot.ai");    var swatchGroup = pmsDoc.groupItems.getByName( "SwatchGroup" );    if (type == "PMS"){        var pmsSwatchName = "PANTONE " + colorInput + " C";        var pmsSwatch = pmsDoc.swatches.getByName( pmsSwatchName );        var startingCMYK = new CMYKColor()            startingCMYK.cyan = pmsSwatch.color.spot.color["cyan"];            startingCMYK.magenta = pmsSwatch.color.spot.color["magenta"];            startingCMYK.yellow = pmsSwatch.color.spot.color["yellow"];            startingCMYK.black = pmsSwatch.color.spot.color["black"];    } else if (type == "CMYK"){        var startingCMYK = new CMYKColor();            startingCMYK.cyan = colorInput[0];            startingCMYK.magenta = colorInput[1];            startingCMYK.yellow = colorInput[2];            startingCMYK.black = colorInput[3];    }    //Create initial swatch, filled according to type of color    var swatchSpot = swatchGroup.pathItems.rectangle( -yStart, 0, 144, 144);        swatchSpot.stroked = false;        type == "PMS" ? swatchSpot.fillColor = pmsSwatch.color : swatchSpot.fillColor = startingCMYK;    //Add color label to initial swatch    var swatchName = swatchGroup.textFrames.add();        type == "PMS" ? swatchName.contents = colorInput.replace(" ", "\n") : swatchName.contents = colorInput[0] + "/" + colorInput[1] + "/" + colorInput[2] + "/" + colorInput[3];        type == "PMS" ? swatchName.textRange.characterAttributes.size = 36 : swatchName.textRange.characterAttributes.size = 18;        swatchName.textRange.characterAttributes.fillColor = new CMYKColor(0, 0, 0, 0);        swatchName.textRange.characterAttributes.textFont = textFonts["MyriadPro-Bold"];        swatchName.textRange.paragraphAttributes.justification = Justification.LEFT;        swatchName.position = [swatchSpot.left + 4, swatchSpot.top];    swatchName.createOutline();    //Add incrementing label to initial swatch    var swLabel = swatchGroup.textFrames.add();        swLabel.contents = "a";        swLabel.textRange.characterAttributes.size = 48;        swLabel.textRange.characterAttributes.fillColor = new CMYKColor(0, 0, 0, 0);        swLabel.textRange.characterAttributes.textFont = textFonts["MyriadPro-Bold"];        swLabel.textRange.paragraphAttributes.justification = Justification.RIGHT;        swLabel.position = [swatchSpot.left + swatchSpot.width - 36, swatchSpot.top - swatchSpot.height + 54];    swLabel.createOutline();    //Variables to hold colors to adjust    var colorsToAdjust = [];    var primaryAdjust = adjustmentColors[0];    var secondaryAdjust = adjustmentColors[1];    //Find all colors that don't equal 0 or 100    for(color in startingCMYK){        if(startingCMYK[color] != 0 && startingCMYK[color] != 100 && color != "typename") colorsToAdjust.push(color);    }    //Determine which two channels to adjust    while(primaryAdjust == undefined || secondaryAdjust == undefined){        switch(colorsToAdjust.length){            //If no colors were found in previous loop, use first two 100% colors found            case 0:                for(color in startingCMYK){                    if(startingCMYK[color] == 100 && color != primaryAdjust && color != "typename" && colorsToAdjust.length <= 2){                        colorsToAdjust.push(color);                    }                }                primaryAdjust = colorsToAdjust[0];                secondaryAdjust = colorsToAdjust[1];                if(colorsToAdjust.length == 0){                    primaryAdjust = "black";                    secondaryAdjust = "yellow";                    //alert("This swatch is white!");                }                break;            //If one color was found in previous loop, use that color as primary and add first 100% color found to secondary            case 1:                primaryAdjust = colorsToAdjust[0];                for(color in startingCMYK){                    if(startingCMYK[color] == 100 && color != primaryAdjust && color != "typename"){                        secondaryAdjust = color;                    }                }                //If no other color was found, pick secondary color based on primary                if(secondaryAdjust == undefined){                    if(primaryAdjust == "cyan") secondaryAdjust = "magenta";                    if(primaryAdjust == "magenta") secondaryAdjust = "yellow";                    if(primaryAdjust == "yellow") secondaryAdjust = "magenta";                    if(primaryAdjust == "black") secondaryAdjust = "cyan";                }                break;            //If two colors were found in previous loop, use color closest to 100% as primary, other color as secondary            case 2:                if(startingCMYK[colorsToAdjust[0]] == startingCMYK[colorsToAdjust[1]]){                    primaryAdjust = colorsToAdjust[0];                    secondaryAdjust = colorsToAdjust[1];                } else{                    var max = Math.max(startingCMYK[colorsToAdjust[0]], startingCMYK[colorsToAdjust[1]]);                    var min = Math.min(startingCMYK[colorsToAdjust[0]], startingCMYK[colorsToAdjust[1]]);                    for(var z=0;z<colorsToAdjust.length;z++){                        if (startingCMYK[colorsToAdjust[z]] == max){                            primaryAdjust = colorsToAdjust[z];                        } else if (startingCMYK[colorsToAdjust[z]] == min){                            secondaryAdjust = colorsToAdjust[z];                        }                    }                }            break;            //If three colors were found, remove color closest to 0% and go through switch again            case 3:                var min = Math.min(startingCMYK[colorsToAdjust[0]], startingCMYK[colorsToAdjust[1]], startingCMYK[colorsToAdjust[2]]);                for(var n=colorsToAdjust.length-1;n>=0;n--){                    if (startingCMYK[colorsToAdjust[n]] == min){                        colorsToAdjust.splice(n, 1)                    }                }            break;            //If four colors were found, remove color closest to 0% and go through switch again            case 4:                var min = Math.min(startingCMYK[colorsToAdjust[0]], startingCMYK[colorsToAdjust[1]], startingCMYK[colorsToAdjust[2]], startingCMYK[colorsToAdjust[3]]);                for(var n=colorsToAdjust.length-1;n>=0;n--){                    if (startingCMYK[colorsToAdjust[n]] == min){                        colorsToAdjust.splice(n, 1)                    }                }            break;        }    }    //I don't remember what these M's and N's are for...    var m=undefined, n=undefined, swCount=0, dif;    var x, i, xMax, iMax;    if(gamut == "lighten"){        x = -4;        xMax = 0;        iMax = 0;    }    if(gamut == "midtones"){        x = -2;        xMax = 2;        iMax = 2;    }    if(gamut == "darken"){        x = 0;        xMax = 4;        iMax = 4;    }    //Offset primary starting values if they are too close to 0    if(100-startingCMYK[primaryAdjust] > 100-(stepRange*Math.abs(xMax-4))){        /*if(Math.floor((100-startingCMYK[primaryAdjust])/stepRange) == (100/stepRange) || Math.floor((100-startingCMYK[primaryAdjust])/stepRange) == (100/stepRange)-1){                      startingCMYK[primaryAdjust] += stepRange*Math.abs(xMax-4);        } else*/ if (Math.floor((100-startingCMYK[primaryAdjust])/stepRange) >= (100/stepRange)-Math.abs(xMax-4)){            dif = Math.floor((100-startingCMYK[primaryAdjust])/stepRange) - ((100/stepRange)-Math.abs(xMax-4));            startingCMYK[primaryAdjust] += stepRange*(dif+1);        }    }    //Offset primary starting values if they are too close to 100    if(100-startingCMYK[primaryAdjust] < stepRange*Math.abs(xMax)){        if(Math.floor((100-startingCMYK[primaryAdjust])/stepRange) == 0){            startingCMYK[primaryAdjust] -= stepRange*Math.abs(xMax);        } else if (Math.floor((100-startingCMYK[primaryAdjust])/stepRange) == 1){            startingCMYK[primaryAdjust] -= stepRange;        }    }    //Offset secondary starting values if they are too close to 0    if(100-startingCMYK[secondaryAdjust] > 100-(stepRange*Math.abs(xMax-4))){        /*if(Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) == (100/stepRange) || Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) == (100/stepRange)-1){                  startingCMYK[secondaryAdjust] += stepRange*Math.abs(xMax-4);        } else*/ if (Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) >= (100/stepRange)-Math.abs(xMax-4)){            dif = Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) - ((100/stepRange)-Math.abs(xMax-4));            startingCMYK[secondaryAdjust] += stepRange*(dif+1);        }    }    //Offset secondary starting values if they are too close to 100    if(100-startingCMYK[secondaryAdjust] < stepRange*Math.abs(xMax)){        if(Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) == 0){            startingCMYK[secondaryAdjust] -= stepRange*Math.abs(xMax);        } else if (Math.floor((100-startingCMYK[secondaryAdjust])/stepRange) == 1){            startingCMYK[secondaryAdjust] -= stepRange;        }    }    //Seconday color loop    for(x;x<=xMax;x++){        if(gamut == "lighten") i = -4;        if(gamut == "midtones") i = -2;        if(gamut == "darken") i = 0;        //Primary color loop        for(i;i<=iMax;i++){            swCount++;            var swatchRect = swatchGroup.pathItems.rectangle(swatchSpot.top, 0, 144, 144);                swatchRect.stroked = false;                swatchRect.fillColor = startingCMYK;            //Change primary color            if(startingCMYK[primaryAdjust] + (stepRange * i) <= 100){                //If actual fill color will exceed 100, force value to 100                if((swatchRect.fillColor[primaryAdjust] + stepRange * i) > 100){                    swatchRect.fillColor[primaryAdjust] = 100;                } else {                    swatchRect.fillColor[primaryAdjust] += stepRange * i;                }            /*} else {                if(n == undefined) n = i-1;                swatchRect.fillColor[primaryAdjust] -= stepRange * (i - n);*/            }            //Change secondary color            if(startingCMYK[secondaryAdjust] + (stepRange * x) <= 100){                //If actual fill color will exceed 100, force value to 100                if((swatchRect.fillColor[secondaryAdjust] + stepRange * x) > 100){                    swatchRect.fillColor[secondaryAdjust] = 100;                } else {                    swatchRect.fillColor[secondaryAdjust] += stepRange * x;                }            /*} else {                if(m == undefined) m = x-1;                swatchRect.fillColor[secondaryAdjust] -= stepRange * (x - m);*/            }            swatchRect.left = swatchRect.left + (144*swCount);            var swLabel = swatchGroup.textFrames.add();                swLabel.textRange.paragraphAttributes.justification = Justification.RIGHT;                swLabel.contents = String.fromCharCode("a".charCodeAt() + swCount);                swLabel.textRange.characterAttributes.size = 48;                swLabel.textRange.characterAttributes.fillColor = new CMYKColor(0, 0, 0, 0);                swLabel.textRange.characterAttributes.textFont = textFonts["MyriadPro-Bold"];                swLabel.position = [swatchRect.left + swatchRect.width - 36, swatchRect.top - swatchRect.height + 54];            if(swLabel.contents == "m" || swLabel.contents == "w") swLabel.position = [swLabel.position[0] - 12, swLabel.position[1]]; //Move wide letters over            swLabel.createOutline();            //alert("cyan: " + swatchRect.fillColor["cyan"] + " magenta: " + swatchRect.fillColor["magenta"] + " yellow: " + swatchRect.fillColor["yellow"] + " black: " + swatchRect.fillColor["black"])        }    }    return swatchGroup;}