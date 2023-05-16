/*
    gShell

    Copyright (C) LiveG. All Rights Reserved.

    https://liveg.tech
    Licensed by the LiveG Open-Source Licence, which can be found at LICENCE.md.
*/

import * as $g from "gshell://lib/adaptui/src/adaptui.js";
import * as sizeUnits from "gshell://lib/adaptui/src/sizeunits.js";
import * as astronaut from "gshell://lib/adaptui/astronaut/astronaut.js";

export var UpdatesPage = astronaut.component("UpdatesPage", function(props, children) {
    const updateStates = {
        LOADING_INDEX: 0,
        UPDATE_AVAILABLE: 1,
        UP_TO_DATE: 2,
        FAILED: 3,
        OFFLINE: 4
    };

    var page = Page() ();
    var readyToUpdateContainer = Container() ();
    var updateProgressIndicator = ProgressIndicator({mode: "secondary"}) ();
    var updateStatusMessage = Paragraph() ();
    var updateNoPowerOffMessage = Paragraph() (BoldTextFragment() (_("updates_powerWarning")));
    var updateCancelButton = Button() (_("cancel"));

    var restartAfterCompleteCheckbox = CheckboxInput({mode: "secondary"}) (); // TODO: Add action

    var updateInProgressContainer = Container() (
        updateProgressIndicator,
        updateStatusMessage,
        updateNoPowerOffMessage,
        Label (
            restartAfterCompleteCheckbox,
            _("updates_restartAfterComplete")
        ),
        ButtonRow (
            updateCancelButton
        )
    );

    updateCancelButton.on("click", function() {
        _sphere.callPrivilegedCommand("updates_cancelUpdate");

        updateCancelButton.setAttribute("disabled", true); // TODO: Recover UI after cancellation to allow restarting update
    });

    updateInProgressContainer.hide();

    var lastState = null;

    function updateData() {
        var data = _sphere.getPrivilegedData();
        var currentState = null;

        if (!data?.updates_canCancelUpdate) {
            updateCancelButton.setAttribute("disabled", true);
            updateCancelButton.setAttribute("title", _("updates_cannotCancel"));

            updateNoPowerOffMessage.show();
        } else {
            updateCancelButton.removeAttribute("disabled");
            updateCancelButton.removeAttribute("title");

            updateNoPowerOffMessage.hide();
        }

        if (data?.updates_updateInProgress) {
            readyToUpdateContainer.hide();
            updateInProgressContainer.show();

            updateStatusMessage.setText(_(`updates_status_${data?.updates_updateStatus}`, {
                progress: data?.updates_updateProgress != null ? Math.round(data?.updates_updateProgress * 100) : null
            }));

            if (data?.updates_updateProgress != null) {
                updateProgressIndicator.setValue(data?.updates_updateProgress);
            } else {
                updateProgressIndicator.removeAttribute("value");
            }

            if (lastState == updateStates.UPDATE_AVAILABLE) {
                return;
            }
        }

        if (data?.updates_checkingFailed) {
            if (!navigator.onLine) {
                currentState = updateStates.OFFLINE;
            } else {
                currentState = updateStates.FAILED;
            }
        } else if (data?.updates_loadingIndex) {
            currentState = updateStates.LOADING_INDEX;
        } else if (data?.updates_index) {
            if (data?.updates_bestUpdate) {
                currentState = updateStates.UPDATE_AVAILABLE;
            } else {
                currentState = updateStates.UP_TO_DATE;
            }
        } else {
            _sphere.callPrivilegedCommand("updates_getUpdates");

            currentState = updateStates.LOADING_INDEX;
        }

        if (currentState == lastState) {
            return;
        }

        lastState = currentState;

        page.clear();

        switch (currentState) {
            case updateStates.LOADING_INDEX:
                page.add(
                    Section (
                        SkeletonLoader("Loading update information...") (
                            Heading() (),
                            Card (
                                Heading(2) (),
                                Paragraph() (),
                                Paragraph() (),
                                Paragraph() ()
                            )
                        )
                    )
                );

                break;

            case updateStates.UPDATE_AVAILABLE:
                var update = data?.updates_bestUpdate;

                var updateNowButton = Button() (_("updates_updateNow"));

                updateNowButton.on("click", function() {
                    _sphere.callPrivilegedCommand("updates_startUpdate", {update});

                    updateNowButton.setAttribute("disabled", true);
                });

                readyToUpdateContainer.clear().add(
                    Separator() (),
                    Paragraph() (_("updates_info_estimatedDownloadSize", {size: sizeUnits.getString(update.estimatedDownloadSize, _)})),
                    ButtonRow (
                        updateNowButton
                    )
                );

                page.add(
                    Section (
                        Heading() (_("updates_latest")),
                        Card({mode: "keepUnlinked"}) (
                            Heading({
                                level: 2,
                                styles: {
                                    fontSize: "1.5rem"
                                }
                            }) (
                                BrandWordmark(_("updates_info_name").trim(), "gshell://media/logo.svg") (_("updates_info_name")),
                                TextFragment({
                                    styles: {
                                        fontWeight: "normal"
                                    }
                                }) (_("updates_info_version", {version: update.version}))
                            ),
                            Container() ().setHTML(new showdown.Converter({
                                headerLevelStart: 3,
                                openLinksInNewWindow: true
                            }).makeHtml(new showdown.Converter().makeHtml(update.description[$g.l10n.getSystemLocaleCode()] || update.description[update.fallbackLocale] || ""))),
                            readyToUpdateContainer,
                            updateInProgressContainer
                        )
                    )
                );

                // TODO: Include custom UI for signifying ready to restart

                break;

            case updateStates.UP_TO_DATE:
            case updateStates.FAILED:
            case updateStates.OFFLINE:
                var checkAgainButton = Button() (_("updates_checkAgain"));

                checkAgainButton.on("click", function() {
                    _sphere.callPrivilegedCommand("updates_getUpdates");
                });

                page.add(
                    Section (
                        Message (
                            Icon({
                                [updateStates.UP_TO_DATE]: "checkmark",
                                [updateStates.FAILED]: "error",
                                [updateStates.OFFLINE]: "offline"
                            }[currentState], "dark embedded") (),
                            Heading() ({
                                [updateStates.UP_TO_DATE]: _("updates_upToDate_title"),
                                [updateStates.FAILED]: _("updates_failed_title"),
                                [updateStates.OFFLINE]: _("updates_offline_title")
                            }[currentState]),
                            Paragraph() ({
                                [updateStates.UP_TO_DATE]: _("updates_upToDate_description"),
                                [updateStates.FAILED]: _("updates_failed_description"),
                                [updateStates.OFFLINE]: _("updates_offline_description")
                            }[currentState]),
                            ButtonRow (
                                checkAgainButton
                            )
                        )
                    )
                );
        }
    }

    _sphere.onPrivilegedDataUpdate(updateData);
    updateData();

    return page;
});