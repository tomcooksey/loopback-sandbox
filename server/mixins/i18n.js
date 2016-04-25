var _ = require('lodash'),
    loopback = require('loopback'),
    Promise = require('bluebird');

/**
 * This mixin uses the supplied i18nModel to manage the translation rows of a particular record
 * @param Model
 * @param options
 */
module.exports = function(Model, options) {

    /**
     * After saving the record we need to make sure the translation tables are up-to-date
     */
    Model.observe('after save', function(ctx, next) {

        var languageModel = loopback.getModelByType('Language'),
            I18NModel = loopback.getModelByType(options.i18nModel),
            savedData = ctx.instance,
            requestContext = loopback.getCurrentContext(),
            requestBody = requestContext.active.http.req.body;

        //This is quite annoying, you can't promisify relationships at the moment, so needs to use a standard callback
        savedData.translations({}, function(err, translationRecords) {
            Promise.all(
                    //Load the enabled languages
                    languageModel.find({
                        where: {
                            enabled: true
                        }
                    })
                )
                .then(function(enabledLanguages) {

                    var indexedTranslations = {},
                        indexedSubmittedData= {},
                        systemLanguage,
                        promises = [],
                        systemRecordChanged;

                    //Index the translation records
                    _.each(translationRecords, function(rec) {
                        indexedTranslations[rec.language_id] = rec;
                    });

                    //Index the submitted translations
                    _.each(requestBody.translations, function(rec) {
                        indexedSubmittedData[rec.language_id] = rec;
                    });

                    //Get the system language
                    _.each(enabledLanguages, function(language) {
                        if(language.system) {
                            systemLanguage = language.id;
                        }
                    });


                    if(indexedSubmittedData[systemLanguage] && indexedTranslations[systemLanguage]) {
                        systemRecordChanged = checkForChanges(indexedSubmittedData[systemLanguage], indexedTranslations[systemLanguage]);
                    }

                    //If no languages were submitted create the system language
                    if(!indexedSubmittedData[systemLanguage]) {
                        indexedSubmittedData[systemLanguage] = {
                            language_id: systemLanguage,
                            title: 'New'
                        };
                    }




                    //Figure out which translation records we have
                    _.each(enabledLanguages, function(language) {

                        var currentTranslation = indexedTranslations[language.id],
                            submittedTranslation = indexedSubmittedData[language.id];

                        if(!currentTranslation) {
                            //If we don't have an existing record for the language, let's create it, if system language, set status to OK, otherwise
                            //set status to EXPIRED
                            if(!submittedTranslation) {
                                submittedTranslation = _.clone(indexedSubmittedData[systemLanguage]);
                                if(submittedTranslation) {
                                    submittedTranslation.language_id = language.id;
                                }else{
                                    return;
                                }

                            }

                            submittedTranslation[options.foreignKey] = savedData.id;
                            if(submittedTranslation && submittedTranslation.language_id === systemLanguage) {
                                submittedTranslation.translation_status = 'OK';
                            }else{
                                submittedTranslation.translation_status = 'EXPIRED';
                            }

                            //Remove any ID submitted, we don't care what it is
                            delete submittedTranslation.id;

                            promises.push(I18NModel.create(submittedTranslation));

                        }else{
                            //If we have a record, let's see if there have been any changes, if there have we want to set the
                            //translation_status to 'OK' so that it's not picked up for translation as obviously it is now the
                            //value the user intends it to be.  The difference is, changing a non-system language will not invalidate
                            //other languages.  If the user then changes the system language record, it will expire the other languages
                            //and they will lose changes they made manually.

                            //If we've detected a difference, let's update the model
                            if(submittedTranslation) {
                                if(checkForChanges(submittedTranslation, currentTranslation)) {

                                    //Check whether the system language has changed and that the translation is NOT the system language
                                    if(systemRecordChanged && currentTranslation.language_id !== systemLanguage) {
                                        submittedTranslation.translation_status = 'EXPIRED';
                                    }else if(currentTranslation.language_id === systemLanguage) {
                                        submittedTranslation.translation_status = 'OK';
                                    }else{
                                        submittedTranslation.translation_status = 'OK';
                                    }

                                    promises.push(currentTranslation.updateAttributes(submittedTranslation));
                                }else{

                                    //If this record didn't change but the system language did, we need to expire the translation
                                    if(systemRecordChanged && currentTranslation.language_id !== systemLanguage) {
                                        submittedTranslation.translation_status = 'EXPIRED';
                                        promises.push(currentTranslation.updateAttributes(submittedTranslation));
                                    }
                                }
                            }else{
                                //Just update the current translation if the system language has changed
                                if(systemRecordChanged && currentTranslation.language_id !== systemLanguage) {
                                    promises.push(currentTranslation.updateAttributes({
                                        translation_status: "EXPIRED"
                                    }));
                                }
                            }
                        }

                    });

                    if(promises.length) {
                        Promise.all(promises)
                            .then(function() {
                                next();
                            });
                    }else{
                        next();
                    }


                });
        });

        /**
         * Loops through the submitted data and compares it the current record,
         * if there are differences it returns true, otherwise false
         * @param submittedTranslation
         * @param currentTranslation
         * @returns {boolean}
         */
        function checkForChanges(submittedTranslation, currentTranslation) {

            var difference = false;

            _.each(Object.keys(submittedTranslation), function(key) {
                if(submittedTranslation[key] !== currentTranslation[key]) {
                    difference = true;
                }
            });

            return difference;

        }

    });

    /**
     * We need to clean up the translations in the scenario that a record is being removed
     */
    Model.observe('after delete', function(ctx, next) {

        //Get the ID of the record that's being deleted
        var requestContext = loopback.getCurrentContext(),
            id = requestContext.active.http.req.params.id,
            I18NModel = loopback.getModelByType(options.i18nModel),
            where = {};

        where[options.foreignKey] = id;

        I18NModel.destroyAll(where)
            .then(function() {
                next();
            });


    });

};