library(plumber)
library(gamlss)
library(ggplot2)
library(dplyr)
library(tidyr)
library(purrr)
library(emmeans)
library(jsonlite)


source("prediction.R")
##source("hypothesis.R")
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
#* @post /fit_model
#* 
function(formula_mean, formula_std_dev, distribution, datasetName, filters="") {
  tryCatch({
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
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
    #pred_df <- data.frame(generate_output(model_formula, dataset = data))  
    
    # create new prediction column for each draw
    total_draws <- 5
    for (i in 1:total_draws) {
      current_draw <- i
      pred_column_name <- paste0("pred", prediction_counter, "_", current_draw)
      
      pred_df_current <- pred_df[pred_df$draw == current_draw, ]
      predictions <- pred_df_current[, dim(pred_df_current)[2]]  # Assuming last column is the prediction
      
      data[[pred_column_name]] <- predictions  # Add new column to the dataset
      data[[pred_column_name]] <- pred_df_current[, dim(pred_df_current)[2]]
      
    }
    
    prediction_counter <<- prediction_counter + 1   # counter for new prediction (new formula)
    
    #write.csv(data, "temp.csv", row.names = FALSE) # temporary csv just for checking purpose
    
    list(
      success = TRUE, 
      result = data,
      aic = aic,
      rsq = rsq
      #global_deviance = global_dev
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
#* @post /test_hypothesis
#* 
function(model, var1, var2, testType, datasetName, filters="") {
  tryCatch({
    
    if (datasetName == 'life_expectancy') {
      data <- read.csv('data/LifeExpect.csv')
    } else if (datasetName == 'airline') {
      data <- read.csv('data/cleaned_airline.csv')
    }
    
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
