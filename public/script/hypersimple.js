const boardData = {
    sections: []
};

var l10n = ln10n_en;

const palettes = [
    "palette-pink",
    "palette-blue",
    "palette-green",
    "palette-yellow",
    "palette-violet",
    "palette-orange"
];

function replaceBoardData(nextBoardData) {
    boardData.sections.splice(0, boardData.sections.length);

    nextBoardData.sections.forEach(function (sectionData) {
        boardData.sections.push({
            id: sectionData.id,
            title: sectionData.title,
            cards: sectionData.cards
        });
    });
}

function redirectToLogin() {
    window.location.href = "/login";
}

function readBoardDataFromFileSystem() {
    return fetch("/api/board", {
        cache: "no-store"
    }).then(function (response) {
        if (response.status === 401) {
            redirectToLogin();
            return null;
        }

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            return null;
        }

        return response.json();
    }).then(function (parsedBoardData) {
        if (!parsedBoardData || !parsedBoardData.sections || !Array.isArray(parsedBoardData.sections)) {
            return;
        }

        replaceBoardData(parsedBoardData);
    });
}

function saveBoardDataToFileSystem() {
    return fetch("/api/board", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(boardData)
    }).then(function (response) {
        if (response.status === 401) {
            redirectToLogin();
        }
    });
}

function rewriteBoardData(updateFunction) {
    updateFunction(boardData);
    saveBoardDataToFileSystem();
    renderBoards();
}

function swapItems(items, firstIndex, secondIndex) {
    const item = items[firstIndex];
    items[firstIndex] = items[secondIndex];
    items[secondIndex] = item;
}

function generateSectionId(title) {
    const baseId = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "section";

    let sectionId = baseId;
    let counter = 2;

    while (boardData.sections.some(function (sectionData) { return sectionData.id === sectionId; })) {
        sectionId = baseId + "_" + counter;
        counter++;
    }

    return sectionId;
}

function createActionButton(label, title, clickHandler) {
    return $("<button>")
        .attr("type", "button")
        .attr("title", title)
        .attr("aria-label", title)
        .addClass("action-button")
        .text(label)
        .on("click", function (event) {
            event.preventDefault();
            event.stopPropagation();
            clickHandler();
        });
}

function createSectionActions(sectionIndex) {
    const $actions = $("<div>")
        .addClass("action-buttons")
        .addClass("section-actions");

    const $moveUp = createActionButton("↑", l10n["move_sect_up"], function () {
        moveSectionUp(sectionIndex);
    });

    const $moveDown = createActionButton("↓", l10n["move_sect_down"], function () {
        moveSectionDown(sectionIndex);
    });

    const $addSection = createActionButton("⊞", l10n["add_sect"], function () {
        addSection(sectionIndex + 1);
    });

    const $addCard = createActionButton("▣", l10n["add_card"], function () {
        addCard(sectionIndex);
    });

    const $removeSection = createActionButton("×", l10n["rem_sect"], function () {
        removeSection(sectionIndex);
    });

    $actions.append($moveUp, $moveDown, $addSection, $addCard, $removeSection);

    return $actions;
}

function createCardActions(sectionIndex, cardIndex) {
    const $actions = $("<div>")
        .addClass("action-buttons")
        .addClass("card-actions");

    const $moveUp = createActionButton("↑", l10n["move_card_up"], function () {
        moveCardUp(sectionIndex, cardIndex);
    });

    const $moveDown = createActionButton("↓", l10n["move_card_down"], function () {
        moveCardDown(sectionIndex, cardIndex);
    });

    const $addItem = createActionButton("＋", l10n["add_line"], function () {
        addItem(sectionIndex, cardIndex);
    });

    const $removeCard = createActionButton("×", l10n["rem_card"], function () {
        removeCard(sectionIndex, cardIndex);
    });

    $actions.append($moveUp, $moveDown, $addItem, $removeCard);

    return $actions;
}

function createItemActions(sectionIndex, cardIndex, itemIndex) {
    const $actions = $("<div>")
        .addClass("action-buttons")
        .addClass("item-actions");

    const $moveUp = createActionButton("↑", l10n["move_line_up"], function () {
        moveItemUp(sectionIndex, cardIndex, itemIndex);
    });

    const $moveDown = createActionButton("↓", l10n["move_line_down"], function () {
        moveItemDown(sectionIndex, cardIndex, itemIndex);
    });

    const $removeItem = createActionButton("×", l10n["rem_line"], function () {
        removeItem(sectionIndex, cardIndex, itemIndex);
    });

    $actions.append($moveUp, $moveDown, $removeItem);

    return $actions;
}

function addSection(insertIndex) {
    const sectionTitle = prompt(l10n["section_title"]);

    if (!sectionTitle) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections.splice(insertIndex, 0, {
            id: generateSectionId(sectionTitle),
            title: sectionTitle,
            cards: []
        });
    });
}

function removeSection(sectionIndex) {
    if (!confirm(l10n["rem_this_sect"])) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections.splice(sectionIndex, 1);
    });
}

function moveSectionUp(sectionIndex) {
    if (sectionIndex === 0) {
        return;
    }

    rewriteBoardData(function (data) {
        swapItems(data.sections, sectionIndex, sectionIndex - 1);
    });
}

function moveSectionDown(sectionIndex) {
    if (sectionIndex >= boardData.sections.length - 1) {
        return;
    }

    rewriteBoardData(function (data) {
        swapItems(data.sections, sectionIndex, sectionIndex + 1);
    });
}

function addCard(sectionIndex) {
    const cardTitle = prompt(l10n["card_title"]);

    if (!cardTitle) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections[sectionIndex].cards.push({
            title: cardTitle,
            items: []
        });
    });
}

function removeCard(sectionIndex, cardIndex) {
    if (!confirm(l10n["rem_this_card"])) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections[sectionIndex].cards.splice(cardIndex, 1);
    });
}

function moveCardUp(sectionIndex, cardIndex) {
    if (cardIndex === 0) {
        return;
    }

    rewriteBoardData(function (data) {
        const cards = data.sections[sectionIndex].cards;
        swapItems(cards, cardIndex, cardIndex - 1);
    });
}

function moveCardDown(sectionIndex, cardIndex) {
    if (cardIndex >= boardData.sections[sectionIndex].cards.length - 1) {
        return;
    }

    rewriteBoardData(function (data) {
        const cards = data.sections[sectionIndex].cards;
        swapItems(cards, cardIndex, cardIndex + 1);
    });
}

function addItem(sectionIndex, cardIndex) {
    const itemText = prompt(l10n["line_text"]);

    if (!itemText) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections[sectionIndex].cards[cardIndex].items.push(itemText);
    });
}

function removeItem(sectionIndex, cardIndex, itemIndex) {
    if (!confirm(l10n["rem_this_line"])) {
        return;
    }

    rewriteBoardData(function (data) {
        data.sections[sectionIndex].cards[cardIndex].items.splice(itemIndex, 1);
    });
}

function moveItemUp(sectionIndex, cardIndex, itemIndex) {
    if (itemIndex === 0) {
        return;
    }

    rewriteBoardData(function (data) {
        const items = data.sections[sectionIndex].cards[cardIndex].items;
        swapItems(items, itemIndex, itemIndex - 1);
    });
}

function moveItemDown(sectionIndex, cardIndex, itemIndex) {
    if (itemIndex >= boardData.sections[sectionIndex].cards[cardIndex].items.length - 1) {
        return;
    }

    rewriteBoardData(function (data) {
        const items = data.sections[sectionIndex].cards[cardIndex].items;
        swapItems(items, itemIndex, itemIndex + 1);
    });
}

function buildSection(sectionData, sectionIndex) {
    const $sectionTitle = $("<div>")
        .addClass("board_title");

    const $title = $("<span>")
        .text(sectionData.title);

    const $count = $("<span>")
        .addClass("a_count")
        .attr("id", "count_" + sectionData.id);

    const $board = $("<main>")
        .addClass("board")
        .attr("id", "board_" + sectionData.id);

    $sectionTitle.append($title, $count, createSectionActions(sectionIndex));
    $("#boards").append($sectionTitle, $board);

    buildBoard(sectionData.id, sectionData.cards, sectionIndex);
}

function buildBoard(boardName, cards, sectionIndex) {
    var count = 0;
    let board = $("#board_" + boardName);
    cards.forEach(function (card, cardIndex) {
        const paletteClass = palettes[cardIndex % palettes.length];

        const $card = $("<section>")
            .addClass("card")
            .addClass(paletteClass);

        const $title = $("<h2>")
            .addClass("card-title")
            .text(card.title);

        const $items = $("<div>")
            .addClass("items");

        card.items.forEach(function (itemText, itemIndex) {
            count++;
            const $item = $("<div>")
                .addClass("item")
                .text(itemText)
                .append(createItemActions(sectionIndex, cardIndex, itemIndex));

            $items.append($item);
        });
        $("#count_" + boardName).html("(" + count + ")");
        
        $card.append($title, $items, createCardActions(sectionIndex, cardIndex));
        board.append($card);
    });
}

function renderEmptyBoardControls() {
    const $sectionTitle = $("<div>")
        .addClass("board_title")
        .addClass("is-action-open");

    const $title = $("<span>")
        .text(l10n["empty_board_title"]);

    const $actions = $("<div>")
        .addClass("action-buttons")
        .addClass("section-actions")
        .append(createActionButton("⊞", l10n["add_sect"], function () {
            addSection(0);
        }));

    $sectionTitle.append($title, $actions);
    $("#boards").append($sectionTitle);
}

function renderBoards() {
    $("#boards").empty();

    if (boardData.sections.length === 0) {
        renderEmptyBoardControls();
        return;
    }

    boardData.sections.forEach(function (sectionData, sectionIndex) {
        buildSection(sectionData, sectionIndex);
    });
}

function bindTouchDoubleTapActions() {
    let lastTapTime = 0;
    let lastTapElement = null;

    $(document).on("pointerup", function (event) {
        if (event.pointerType !== "touch") {
            return;
        }

        if ($(event.target).closest(".action-button").length) {
            return;
        }

        const $target = $(event.target).closest(".item, .card, .board_title");

        if (!$target.length) {
            return;
        }

        const currentTime = Date.now();
        const currentElement = $target.get(0);

        if (lastTapElement === currentElement && currentTime - lastTapTime < 360) {
            event.preventDefault();
            event.stopPropagation();
            $(".is-action-open").not($target).removeClass("is-action-open");
            $target.toggleClass("is-action-open");
            lastTapTime = 0;
            lastTapElement = null;
            return;
        }

        lastTapTime = currentTime;
        lastTapElement = currentElement;
    });

    $(document).on("pointerup", function (event) {
        if (event.pointerType !== "touch") {
            return;
        }

        if ($(event.target).closest(".item, .card, .board_title, .action-button").length) {
            return;
        }

        $(".is-action-open").removeClass("is-action-open");
    });
}

function applyLanguage(currentLang) {
    switch (currentLang) {
            case "it":
                l10n = ln10n_it;
                break;
            default:
                l10n = ln10n_en;
                break;
    }
}

function setLanguage() {
    const params = new URLSearchParams(window.location.search);
    const lan = params.get("lan");

    if (lan) {
        applyLanguage(lan);

        return fetch("/api/settings/lang", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ lan: lan })
        }).then(function (response) {
            if (response.status === 401) {
                redirectToLogin();
            }
        });
    }

    return fetch("/api/settings", {
        cache: "no-store"
    }).then(function (response) {
        if (response.status === 401) {
            redirectToLogin();
            return null;
        }

        if (!response.ok) {
            return null;
        }

        return response.json();
    }).then(function (settings) {
        applyLanguage(settings && settings.lan ? settings.lan : "en");
    });
}

$(function () {
    setLanguage().then(function () {
        return readBoardDataFromFileSystem();
    }).then(function () {
        bindTouchDoubleTapActions();
        renderBoards();
    });
});
