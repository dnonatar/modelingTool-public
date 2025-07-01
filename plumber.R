library(plumber)
library(gamlss)
library(ggplot2)
library(dplyr)
library(tidyr)
library(purrr)
library(emmeans)
library(jsonlite)


source("prediction.R")
source("hypothesis.R")
source("effectSize.R")

#data <- read.csv('data/happiness.csv')
#data <- read.csv('data/LifeExpect.csv')

# Enable CORS
#* @filter cors
cors <- function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  res$setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
  res$setHeader("Access-Control-Allow-Headers", "Content-Type")
  if (req$REQUEST_METHOD == "OPTIONS") {
    res$status <- 200
    return(list())
  }
  plumber::forward()
}


# Counter for prediction columns
prediction_counter <- 1

#* Fit a model with the given formula
#* @param formula_mean A formula string for the mean
#* @param formula_std_dev A formula string for the standard deviation
#* @param distribution String for distribution
#* @param datasetName String for dataset
#* @param filters
#* @param filter_indices
#* @post /fit_model
#* 
function(formula_mean, formula_std_dev, distribution, datasetName, filters="", filter_indices = NULL) {
  tryCatch({
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
    print("before indice filter")
    print(dim(data))
    
    ## apply index filtering
    if (!is.null(filter_indices) && length(filter_indices) > 0) {
      filter_indices <- as.numeric(unlist(filter_indices)) + 1  # JS is 0-based; R is 1-based
      data <- data[-filter_indices, ]
    }
    print("after indice filter")
    print(dim(data))
    
    print(filters)
    # Apply filters if provided and not empty
    if (length(filters)!=0) {
      print("filtering")
      #filters <- jsonlite::fromJSON(filters)  # Convert JSON string to R list
      for (feature in names(filters)) {
        selected_values <- unlist(filters[[feature]])  # Convert to vector
        data <- data %>% filter(.data[[feature]] %in% selected_values)
      }
    }
    
    # get predictions using input formula and prediction.R
    
    mu_formula <- formula_mean ## string 
    sigma_formula <- sub(".*~", "~", formula_std_dev) 
    
    output <- generate_output(mu_formula,sigma_formula, distribution, dataset = data)
    
    #global_dev <- output$gd
    aic <- output$aic
    pred_df <- data.frame(output$df)
    rsq <- output$rsq
    res_df <- output$df_res
    
    data <- cbind(data, res_df)
    
    #pred_df <- data.frame(generate_output(model_formula, dataset = data))  
    
    # create new prediction column for each draw
    total_draws <- 5
    all_new_data <- list()
    for (i in 1:total_draws) {
      current_draw <- i
      pred_column_name <- paste0("pred", prediction_counter, "_", current_draw)
      
      pred_df_current <- pred_df[pred_df$draw == current_draw, ]
      predictions <- pred_df_current[, dim(pred_df_current)[2]]  # Assuming last column is the prediction
      
      data[[pred_column_name]] <- predictions  # Add new column to the dataset
      data[[pred_column_name]] <- pred_df_current[, dim(pred_df_current)[2]]
      
      # ########
      # ## fit model to get slope
      # ########
      # mu_spec <- as.formula(mu_formula)
      # term_labels <- attr(terms(mu_spec), "term.labels")
      # all_vars <- all.vars(mu_spec)[-1]
      # 
      # # Identify variable types
      # var_types <- sapply(data[all_vars], function(x) {
      #   if (is.factor(x) || is.character(x)) {
      #     "categorical"
      #   } else if (is.numeric(x)) {
      #     "continuous"
      #   } else {
      #     class(x)
      #   }
      # })
      # 
      # new_formula <- as.formula(sub("^\\s*[^~]+", pred_column_name, mu_formula))  # newformula for this current sample
      # pred_model <- gamlss(new_formula, sigma.formula = ~1, family = NO(), data = data)
      # 
      # # Store each prediction dataframe
      # prediction_dfs <- list()
      # 
      # # Loop through each continuous variable
      # for (xVar in names(var_types[var_types == "continuous"])) {
      #   
      #   # Identify interaction terms involving xVar
      #   interactions <- grep(paste0("(^|:)", xVar, "(:|$)"), term_labels, value = TRUE)
      #   
      #   # Find if there's a categorical partner
      #   groupVar <- NULL
      #   for (int_term in interactions) {
      #     parts <- unlist(strsplit(int_term, ":"))
      #     partner <- setdiff(parts, xVar)
      #     if (length(partner) == 1 && var_types[partner] == "categorical") {
      #       groupVar <- partner
      #       break
      #     }
      #   }
      #   
      #   # Construct new_data
      #   if (!is.null(groupVar)) {
      #     new_data <- setNames(
      #       expand.grid(
      #         seq(min(data[[xVar]], na.rm = TRUE),
      #             max(data[[xVar]], na.rm = TRUE),
      #             length.out = 100),
      #         unique(data[[groupVar]])
      #       ),
      #       c(xVar, groupVar)
      #     )
      #   } else {
      #     new_data <- data.frame(seq(min(data[[xVar]], na.rm = TRUE),
      #                                max(data[[xVar]], na.rm = TRUE),
      #                                length.out = 100))
      #     names(new_data) <- xVar
      #   }
      #   
      #   # Add predictions
      #   new_data$fit <- predict(pred_model, newdata = new_data, data = data, type = "response", se.fit = FALSE)
      #   new_data$variable <- xVar
      #   if (is.null(groupVar)) {
      #     new_data$group <- NA
      #   } else {
      #     names(new_data)[names(new_data) == groupVar] <- "group"
      #   }
      #   new_data$draw <- i  
      #   prediction_dfs[[xVar]] <- new_data
      # }
      # 
      # final_df <- do.call(rbind, prediction_dfs) ## combine all vars for one loop
      # rownames(final_df) <- NULL
      # 
      # all_new_data[[i]] <- final_df
      # 
      # # xVars <- all.vars(new_formula[[3]])  # Extract variables after ~
      # # print(paste("xVars:", toString(xVars)))
      # # for (xVar in xVars) {
      # #   if (is.numeric(data[[xVar]])) {
      # #     new_data <- data.frame(seq(
      # #       min(data[[xVar]], na.rm = TRUE),
      # #       max(data[[xVar]], na.rm = TRUE),
      # #       length.out = 100
      # #     ))
      # #     names(new_data) <- xVar
      # #     new_data$fit <- predict(pred_model, newdata = new_data, data = data, type = "response", se.fit = FALSE)
      # #     new_data$draw <- i
      # #     
      # #     all_new_data[[i]] <- new_data
      # #   }
      # # }
    }
    
    #pred_lines <- do.call(rbind, all_new_data) ## combine all loops
    
    prediction_counter <<- prediction_counter + 1   # counter for new prediction (new formula)
    
    #write.csv(data, "temp.csv", row.names = FALSE) # temporary csv just for checking purpose
    
    list(
      success = TRUE, 
      result = data,
      aic = aic,
      rsq = rsq
      #linefit_data = output$linefit_data,  ## for original dataset
      #predfit_data = pred_lines     ## for predicted data
      #global_deviance = global_dev
    )
    
  }, error = function(e) {
    # Error handling
    list(success = FALSE, error = e$message)
  })
}


#* Fit a model and return fit line separated by groupVar
#* @param formula_mean A formula string for the mean
#* @param formula_std_dev A formula string for the standard deviation
#* @param xVar
#* @param groupVar
#* @param distribution String for distribution
#* @param datasetName String for dataset
#* @param filters
#* @param filter_indices
#* @post /fit_submodel
#* 
function(formula_mean, formula_std_dev, xVar, groupVar, distribution, datasetName, filters="", filter_indices = NULL) {
  tryCatch({
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
    print("before indice filter")
    print(dim(data))
    
    ## apply index filtering
    if (!is.null(filter_indices) && length(filter_indices) > 0) {
      filter_indices <- as.numeric(unlist(filter_indices)) + 1  # JS is 0-based; R is 1-based
      data <- data[-filter_indices, ]
    }
    print("after indice filter")
    print(dim(data))
    
    # Apply filters if provided and not empty
    if (length(filters)!=0) {
      print("filtering")
      #filters <- jsonlite::fromJSON(filters)  # Convert JSON string to R list
      for (feature in names(filters)) {
        selected_values <- unlist(filters[[feature]])  # Convert to vector
        data <- data %>% filter(.data[[feature]] %in% selected_values)
      }
    }
    
    # get predictions using input formula and prediction.R
    
    mu_formula <- formula_mean ## string 
    
    #model <- lm(as.formula(mu_formula), data = data)
    model <- gamlss(as.formula(mu_formula), family = NO(), data = data)
    
    # Create grid
    new_data <- setNames(
      expand.grid(
        seq(min(data[[xVar]]), max(data[[xVar]]), length.out = 100),
        unique(data[[groupVar]])
      ),
      c(xVar, groupVar)
    )
    
    # Predict with SE
    #pred <- predict(model, newdata = new_data, se.fit = TRUE)
    pred <- predict(model, newdata = new_data, data = data, type="response", se.fit = FALSE)
    #pred <- predict(model, se.fit = TRUE, type = "response")
    
    # Build result frame
    #data$fit <- pred$fit  ## if se.fit = TRUE
    new_data$fit <- pred  ## if se.fit = FALSE
    #data$lower <- pred$fit - 1.96 * pred$se.fit
    #data$upper <- pred$fit + 1.96 * pred$se.fit
    
    ## return data points for drawing line fit
    list(
      success = TRUE,
      result = new_data
    )
    
  }, error = function(e) {
    # Error handling
    list(success = FALSE, error = e$message)
  })
}


#* Test hypothesis of the selected chart
#* @param model formula string
#* @param var1
#* @param var2 
#* @param testType
#* @param datasetName String for dataset
#* @param filters
#* @param filter_indices
#* @post /test_hypothesis
#* 
function(model, var1, var2, testType, datasetName, filters="", filter_indices = NULL) {
  tryCatch({
    
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
    print("before indice filter")
    print(dim(data))
    
    ## apply index filtering
    if (!is.null(filter_indices) && length(filter_indices) > 0) {
      filter_indices <- as.numeric(unlist(filter_indices)) + 1  # JS is 0-based; R is 1-based
      data <- data[-filter_indices, ]
    }
    print("after indice filter")
    print(dim(data))
    
    # Apply filters if provided and not empty
    if (length(filters)!=0) {
      #filters <- jsonlite::fromJSON(filters)  # Convert JSON string to R list
      for (feature in names(filters)) {
        selected_values <- unlist(filters[[feature]])  # Convert to vector
        data <- data %>% filter(.data[[feature]] %in% selected_values)
      }
    }
    
    results <- test_hypothesis(as.formula(model), var1 = var1, var2 = var2, testType = testType, data = data)
    print(results)
    # Call the test_hypothesis function
    list(success = TRUE, results = results)
  }, error = function(e) {
    print('error')
    list(success = FALSE, error = e$message)
  })
}


#* Get effect size distribution
#* @param model formula string
#* @param var1
#* @param var2 
#* @param contrast String for contrast of interest
#* @param datasetName String for dataset
#* @post /get_effectSize
#* 
function(model, var1, var2, contrast, datasetName) {
  tryCatch({
    
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
    results <- get_effect_distr(as.formula(model), var1, var2, contrast, df=data)
    print(results)
    
    # Call the test_hypothesis function
    list(success = TRUE, results = results)
    
  }, error = function(e) {
    print('error')
    list(success = FALSE, error = e$message)
  })
}



